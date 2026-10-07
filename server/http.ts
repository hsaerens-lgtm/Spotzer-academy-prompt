import type { IncomingMessage, ServerResponse } from 'node:http'
import { correctRequestSchema, runRequestSchema, type ApiError, type BlocksFile } from '../src/workshop/model.ts'
import type { ServerConfig } from './config.ts'
import { correctPrompt } from './correct.ts'
import type { CallOptions, CallResult } from './openai.ts'
import type { RateLimiter } from './rateLimit.ts'
import { runPrompt } from './run.ts'
import { serveStatic } from './static.ts'

/** 32 KiB: a 6000-character run prompt in 3-byte characters, with its JSON escaping, is about 18 KiB. */
export const MAX_BODY_BYTES = 32 * 1024

export interface LogEntry {
  route: string
  status: number
  ms: number
}

export interface HandlerDeps {
  config: ServerConfig
  blocks: BlocksFile
  call: (options: CallOptions) => Promise<CallResult>
  limiter: RateLimiter
  distDir: string | null
  /** Receives one entry per request: never the request body. */
  log?: (entry: LogEntry) => void
  now?: () => number
}

const statusFor = (error: ApiError) => (error === 'timeout' ? 504 : error === 'rate' ? 429 : error === 'invalid' ? 400 : 502)

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(JSON.stringify(body))
}

/** Reads the body, or returns null the moment it grows past the limit: the rest is neither kept nor read. */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        req.pause()
        resolve(null)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

const MAPPED_IPV4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i

/**
 * Who is asking, for the rate limit. Behind exactly one trusted reverse proxy that appends to X-Forwarded-For, the
 * last entry is the client as that proxy saw it; everything before it is what the client chose to send.
 */
export function clientKey(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers['x-forwarded-for']
  const hop = trustProxy && typeof forwarded === 'string' ? forwarded.split(',').at(-1)?.trim() : undefined
  // A dual-stack socket reports an IPv4 client as ::ffff:1.2.3.4: count it as the same client as 1.2.3.4.
  return (hop || req.socket.remoteAddress)?.replace(MAPPED_IPV4, '$1') ?? 'unknown'
}

/** The path of the request target, or null when it is not a plain "/path": URL would read "//x" as a host and a backslash as a slash. */
function pathOf(target: string): string | null {
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) return null
  try {
    return new URL(target, 'http://localhost').pathname
  } catch {
    return null
  }
}

/** The media type of a Content-Type header: "Application/JSON; charset=utf-8" is "application/json". */
const mediaType = (header: string | undefined) => (header ?? '').split(';')[0].trim().toLowerCase()

export function createHandler(deps: HandlerDeps) {
  const now = deps.now ?? Date.now
  const handle = async (req: IncomingMessage, res: ServerResponse, started: number): Promise<void> => {
    const route = pathOf(req.url ?? '/')
    const method = req.method ?? 'GET'
    const finish = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      sendJson(res, status, body, headers)
      deps.log?.({ route: route ?? '?', status, ms: now() - started })
    }

    if (route === null) return finish(400, { error: 'invalid' })

    if (!route.startsWith('/api/')) {
      if (deps.distDir && (method === 'GET' || method === 'HEAD')) {
        const status = await serveStatic(deps.distDir, route, res, method)
        deps.log?.({ route, status, ms: now() - started })
        return
      }
      return finish(404, { error: 'invalid' })
    }
    if (route === '/api/health') {
      if (method !== 'GET') return finish(405, { error: 'invalid' }, { Allow: 'GET' })
      return finish(200, { corrector: deps.config.apiKey !== null })
    }
    if (route !== '/api/correct' && route !== '/api/run') return finish(404, { error: 'invalid' })
    if (method !== 'POST') return finish(405, { error: 'invalid' }, { Allow: 'POST' })
    const apiKey = deps.config.apiKey
    if (!apiKey) return finish(503, { error: 'unavailable' })
    if (!sameOrigin(req)) return finish(403, { error: 'invalid' })
    if (mediaType(req.headers['content-type']) !== 'application/json') return finish(415, { error: 'invalid' })
    // Too large: answer now and close the connection, without reading what the client may still be sending.
    const tooLarge = () => finish(413, { error: 'invalid' }, { Connection: 'close' })
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) return tooLarge()
    const body = await readBody(req)
    if (body === null) return tooLarge()
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch {
      return finish(400, { error: 'invalid' })
    }

    if (route === '/api/correct') {
      const parsed = correctRequestSchema.safeParse(json)
      if (!parsed.success) return finish(400, { error: 'invalid' })
      const decision = deps.limiter.take(clientKey(req, deps.config.trustProxy))
      if (!decision.ok) return finish(429, { error: 'rate' }, { 'Retry-After': String(decision.retryAfter) })
      const result = await correctPrompt(parsed.data, { config: deps.config, apiKey, blocks: deps.blocks, call: deps.call })
      return result.ok ? finish(200, result.report) : finish(statusFor(result.error), { error: result.error })
    }

    const parsed = runRequestSchema.safeParse(json)
    if (!parsed.success) return finish(400, { error: 'invalid' })
    const decision = deps.limiter.take(clientKey(req, deps.config.trustProxy))
    if (!decision.ok) return finish(429, { error: 'rate' }, { 'Retry-After': String(decision.retryAfter) })
    const result = await runPrompt(parsed.data.prompt, { config: deps.config, apiKey, call: deps.call })
    if (!result.ok) return finish(statusFor(result.error), { error: result.error })
    return finish(200, result.truncated ? { answer: result.answer, truncated: true } : { answer: result.answer })
  }

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const started = now()
    try {
      await handle(req, res, started)
    } catch {
      // Whatever failed, say nothing about it: not what was asked, not the error.
      if (res.headersSent) res.destroy()
      else sendJson(res, 500, { error: 'error' })
      deps.log?.({ route: '?', status: 500, ms: now() - started })
    }
  }
}
