// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request, type IncomingMessage, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeBlocksFile, makeReport } from '../src/test/workshopFixtures'
import { readConfig } from './config.ts'
import { clientKey, createHandler, MAX_BODY_BYTES, type LogEntry } from './http.ts'
import type { CallResult } from './openai.ts'
import { createRateLimiter } from './rateLimit.ts'

let server: Server
let base: string
let port: number
let logs: LogEntry[]
let call: ReturnType<typeof vi.fn<() => Promise<CallResult>>>

async function start(options: { env?: Record<string, string>; distDir?: string | null; perMinute?: number } = {}) {
  logs = []
  call = vi.fn<() => Promise<CallResult>>(async () => ({ ok: true, text: JSON.stringify(makeReport()) }))
  const handler = createHandler({
    config: readConfig(options.env ?? { OPENAI_API_KEY: 'test-key' }),
    blocks: makeBlocksFile(),
    call,
    limiter: createRateLimiter({ perMinute: options.perMinute ?? 10, perDay: 100, globalPerDay: 1000 }),
    distDir: options.distDir ?? null,
    log: (entry) => logs.push(entry),
  })
  server = createServer((req, res) => void handler(req, res))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as { port: number }).port
  base = `http://127.0.0.1:${port}`
}

const tempDirs: string[] = []
const tempDist = () => {
  const dir = mkdtempSync(join(tmpdir(), 'academy-dist-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
})

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })

/** Raw request, for headers fetch would not send and paths it would normalise. */
function raw(path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: options.method ?? 'GET', headers: options.headers }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end(options.body)
  })
}

test('health says whether the corrector has a key', async () => {
  await start()
  expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ corrector: true })
  await new Promise((resolve) => server.close(resolve))
  await start({ env: {} })
  expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ corrector: false })
})

test('checks a prompt and returns the report', async () => {
  await start()
  const response = await post('/api/correct', { prompt: 'Write a post', lang: 'en' })
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect((await response.json()).score).toBe(62)
})

test('runs a prompt', async () => {
  await start()
  call.mockResolvedValueOnce({ ok: true, text: 'Hello!' })
  const response = await post('/api/run', { prompt: 'Say hello' })
  expect(await response.json()).toEqual({ answer: 'Hello!' })
})

test('refuses bad input: broken JSON, wrong shape, too large, not JSON, another origin', async () => {
  await start()
  expect((await post('/api/correct', '{not json')).status).toBe(400)
  expect((await post('/api/correct', { prompt: '', lang: 'en' })).status).toBe(400)
  // Past the prompt limit but inside the body limit: the schema refuses it, not the size check.
  expect((await post('/api/correct', { prompt: 'x'.repeat(20_000), lang: 'en' })).status).toBe(400)
  expect((await post('/api/correct', { prompt: 'x'.repeat(MAX_BODY_BYTES), lang: 'en' })).status).toBe(413)
  const textPlain = await fetch(`${base}/api/run`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"prompt":"Hi"}' })
  expect(textPlain.status).toBe(415)
  const crossOrigin = await raw('/api/correct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' },
    body: JSON.stringify({ prompt: 'Hi', lang: 'en' }),
  })
  expect(crossOrigin.status).toBe(403)
  expect(call).not.toHaveBeenCalled()
})

test('the body limit is 32 KiB: the longest run prompt in 3-byte characters fits, a body past it is refused', async () => {
  await start()
  expect(MAX_BODY_BYTES).toBe(32 * 1024)
  const euro = String.fromCodePoint(0x20ac) // 3 bytes in UTF-8
  const longest = JSON.stringify({ prompt: euro.repeat(6000) })
  expect(Buffer.byteLength(longest)).toBeGreaterThan(16 * 1024)
  expect(Buffer.byteLength(longest)).toBeLessThanOrEqual(MAX_BODY_BYTES)
  expect((await post('/api/run', longest)).status).toBe(200)
  expect(call).toHaveBeenCalledTimes(1)

  const tooBig = JSON.stringify({ prompt: 'x'.repeat(MAX_BODY_BYTES) })
  expect((await post('/api/run', tooBig)).status).toBe(413)
  // No Content-Length to check up front: the size is counted while the body is read.
  const chunked = await raw('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
    body: tooBig,
  })
  expect(chunked.status).toBe(413)
  expect(call).toHaveBeenCalledTimes(1)
})

test('a streamed body is refused as soon as it passes the limit, without waiting for the rest', async () => {
  await start()
  const status = await new Promise<number>((resolve) => {
    const req = request(
      { host: '127.0.0.1', port, path: '/api/run', method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } },
      (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
        req.destroy()
      },
    )
    req.on('error', () => {})
    // The request is never ended: only an answer given on the way can resolve this.
    for (let sent = 0; sent <= MAX_BODY_BYTES; sent += 8 * 1024) req.write(Buffer.alloc(8 * 1024, 'x'))
  })
  expect(status).toBe(413)
  expect(call).not.toHaveBeenCalled()
})

test('the content type is compared as a media type, not searched for a substring', async () => {
  await start()
  const body = JSON.stringify({ prompt: 'Hi' })
  for (const type of ['Application/JSON', 'application/json; charset=utf-8']) {
    expect((await raw('/api/run', { method: 'POST', headers: { 'Content-Type': type }, body })).status, type).toBe(200)
  }
  for (const type of ['text/plain; x=application/json', 'application/jsonp', 'text/application/json']) {
    expect((await raw('/api/run', { method: 'POST', headers: { 'Content-Type': type }, body })).status, type).toBe(415)
  }
})

test('a request from the site itself, with Origin equal to Host, goes through; another port is another origin', async () => {
  await start()
  const body = JSON.stringify({ prompt: 'Hi' })
  const from = (origin: string) => raw('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body })
  expect((await from(`http://127.0.0.1:${port}`)).status).toBe(200)
  expect((await from(`http://127.0.0.1:${port + 1}`)).status).toBe(403)
})

test('without a key the corrector is unavailable and never calls OpenAI', async () => {
  await start({ env: {} })
  const response = await post('/api/correct', { prompt: 'Hi', lang: 'en' })
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'unavailable' })
  expect(call).not.toHaveBeenCalled()
})

test('applies the rate limit with a Retry-After header', async () => {
  await start({ perMinute: 1 })
  expect((await post('/api/run', { prompt: 'Hi' })).status).toBe(200)
  const limited = await post('/api/run', { prompt: 'Hi' })
  expect(limited.status).toBe(429)
  expect(limited.headers.get('retry-after')).toBe('60')
  expect(await limited.json()).toEqual({ error: 'rate' })
})

test('maps a timeout to 504 and an unreachable AI to 502', async () => {
  await start()
  call.mockResolvedValueOnce({ ok: false, error: 'timeout' })
  expect((await post('/api/run', { prompt: 'Hi' })).status).toBe(504)
  call.mockResolvedValueOnce({ ok: false, error: 'upstream' })
  expect((await post('/api/run', { prompt: 'Hi' })).status).toBe(502)
})

test('logs routes, statuses and durations, never the prompt or the key', async () => {
  await start()
  await post('/api/correct', { prompt: 'My secret client plan', lang: 'en' })
  expect(logs).toEqual([{ route: '/api/correct', status: 200, ms: expect.any(Number) }])
  expect(JSON.stringify(logs)).not.toContain('secret')
  expect(JSON.stringify(logs)).not.toContain('test-key')
})

test('unknown API routes are 404 and other methods are 405', async () => {
  await start()
  expect((await fetch(`${base}/api/nope`)).status).toBe(404)
  expect((await fetch(`${base}/api/correct`)).status).toBe(405)
  expect((await post('/api/health', {})).status).toBe(405)
})

test('serves the built site with the right types and blocks path traversal', async () => {
  const dist = tempDist()
  mkdirSync(join(dist, 'assets'))
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Academy</title>')
  writeFileSync(join(dist, 'assets', 'app.js'), 'console.log(1)')
  await start({ distDir: dist })
  const index = await fetch(`${base}/`)
  expect(index.headers.get('content-type')).toBe('text/html; charset=utf-8')
  expect(await index.text()).toContain('Academy')
  const script = await fetch(`${base}/assets/app.js`)
  expect(script.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
  expect(script.headers.get('cache-control')).toContain('immutable')
  expect((await fetch(`${base}/missing.txt`)).status).toBe(404)
  expect((await raw('/..%2fpackage.json')).status).toBe(403)
  // An encoded backslash is a separator on Windows (403) and an ordinary character elsewhere (no such file).
  expect((await raw('/..%5cpackage.json')).status).toBe(process.platform === 'win32' ? 403 : 404)
  expect((await raw('/assets/..%5c..%5cpackage.json')).status).toBe(process.platform === 'win32' ? 403 : 404)
  const head = await raw('/', { method: 'HEAD' })
  expect(head.status).toBe(200)
  expect(head.body).toBe('')
})

test('never serves dotfiles such as the build manifest, however the path is written', async () => {
  const dist = tempDist()
  mkdirSync(join(dist, '.vite'))
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Academy</title>')
  writeFileSync(join(dist, '.vite', 'manifest.json'), '{"build":"details"}')
  writeFileSync(join(dist, '.env'), 'SECRET=1')
  await start({ distDir: dist })
  for (const path of ['/.vite/manifest.json', '/%2evite/manifest.json', '/assets/../.vite/manifest.json', '/.env']) {
    const response = await raw(path)
    expect(response.status, path).toBe(404)
    expect(response.body, path).not.toContain('details')
  }
  expect((await fetch(`${base}/`)).status).toBe(200)
})

test('answers a malformed request target with 400 and logs no route', async () => {
  await start()
  const response = await raw('//')
  expect(response.status).toBe(400)
  expect(JSON.parse(response.body)).toEqual({ error: 'invalid' })
  expect((await raw('//api/health')).status).toBe(400)
  expect((await raw('/api\\health')).status).toBe(400)
  expect(logs).toEqual([
    { route: '?', status: 400, ms: expect.any(Number) },
    { route: '?', status: 400, ms: expect.any(Number) },
    { route: '?', status: 400, ms: expect.any(Number) },
  ])
  expect(call).not.toHaveBeenCalled()
})

test('an unexpected failure answers a bare 500 and logs nothing from the error', async () => {
  await start()
  call.mockRejectedValueOnce(new Error('boom sk-leaky-detail'))
  const response = await post('/api/run', { prompt: 'My secret client plan' })
  expect(response.status).toBe(500)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  expect(await response.json()).toEqual({ error: 'error' })
  expect(logs).toEqual([{ route: '?', status: 500, ms: expect.any(Number) }])
  expect(JSON.stringify(logs)).not.toMatch(/boom|leaky|secret/)
  // The server is still up.
  expect((await fetch(`${base}/api/health`)).status).toBe(200)
})

const fakeRequest = (headers: Record<string, string>, remoteAddress?: string) => ({ headers, socket: { remoteAddress } }) as unknown as IncomingMessage

test('the client key is the socket address with IPv4-mapped IPv6 normalised, or the address the trusted proxy appended', () => {
  expect(clientKey(fakeRequest({}, '::ffff:1.2.3.4'), false)).toBe('1.2.3.4')
  expect(clientKey(fakeRequest({}, '::FFFF:10.0.0.7'), false)).toBe('10.0.0.7')
  expect(clientKey(fakeRequest({}, '127.0.0.1'), false)).toBe('127.0.0.1')
  expect(clientKey(fakeRequest({}, '2001:db8::1'), false)).toBe('2001:db8::1')
  expect(clientKey(fakeRequest({}, undefined), false)).toBe('unknown')
  // A forwarded address is only believed behind a proxy we were told about, and then only the last entry:
  // the one our single trusted proxy appended. Anything before it is whatever the client chose to send.
  expect(clientKey(fakeRequest({ 'x-forwarded-for': '9.9.9.9' }, '::ffff:1.2.3.4'), true)).toBe('9.9.9.9')
  expect(clientKey(fakeRequest({ 'x-forwarded-for': '6.6.6.6, 9.9.9.9' }, '10.0.0.1'), true)).toBe('9.9.9.9')
  expect(clientKey(fakeRequest({ 'x-forwarded-for': '6.6.6.6,7.7.7.7 , 9.9.9.9 ' }, '10.0.0.1'), true)).toBe('9.9.9.9')
  expect(clientKey(fakeRequest({ 'x-forwarded-for': '::ffff:9.9.9.9' }, '10.0.0.1'), true)).toBe('9.9.9.9')
  expect(clientKey(fakeRequest({ 'x-forwarded-for': ' ' }, '10.0.0.1'), true)).toBe('10.0.0.1')
  expect(clientKey(fakeRequest({ 'x-forwarded-for': '6.6.6.6, 9.9.9.9' }, '::ffff:1.2.3.4'), false)).toBe('1.2.3.4')
})
