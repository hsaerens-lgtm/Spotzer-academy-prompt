import type { ZodType } from 'zod'
import { apiErrorSchema, correctorReportSchema, healthSchema, runResponseSchema, type ApiError } from '../../../workshop/model'
import type { ApiResult, CorrectorApi } from '../store'

/** The server gives each AI call 30 s (OPENAI_TIMEOUT_MS by default), and a check up to two calls. */
const SERVER_AI_TIMEOUT_MS = 30_000
const MARGIN_MS = 5_000
/** How long the browser waits before giving up with "timeout": a little longer than the server, which answers 504 itself. */
export const CLIENT_TIMEOUT_MS = {
  health: 10_000,
  correct: 2 * SERVER_AI_TIMEOUT_MS + MARGIN_MS,
  run: SERVER_AI_TIMEOUT_MS + MARGIN_MS,
} as const

const errorForStatus = (status: number): ApiError =>
  status === 429 ? 'rate' : status === 504 ? 'timeout' : status === 400 || status === 413 ? 'invalid' : status >= 500 || status === 404 ? 'unavailable' : 'error'

async function request<T>(fetchImpl: typeof fetch, path: string, init: RequestInit, schema: ZodType<T>, timeoutMs: number): Promise<ApiResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response: Response
    try {
      response = await fetchImpl(path, {
        ...init,
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      })
    } catch {
      return { ok: false, error: controller.signal.aborted ? 'timeout' : 'unavailable' }
    }
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // The body stops arriving when the time is up: that is a timeout too, not a malformed answer.
      if (controller.signal.aborted) return { ok: false, error: 'timeout' }
      body = null
    }
    if (!response.ok) {
      const error = apiErrorSchema.safeParse(body)
      return { ok: false, error: error.success ? error.data.error : errorForStatus(response.status) }
    }
    const parsed = schema.safeParse(body)
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'error' }
  } finally {
    clearTimeout(timer)
  }
}

/** The corrector's server, on the site's own origin (relative paths work from any folder). */
export function createCorrectorApi(fetchImpl: typeof fetch = (...args) => fetch(...args)): CorrectorApi {
  return {
    health: () => request(fetchImpl, 'api/health', { method: 'GET' }, healthSchema, CLIENT_TIMEOUT_MS.health),
    correct: (body) =>
      request(fetchImpl, 'api/correct', { method: 'POST', body: JSON.stringify(body) }, correctorReportSchema, CLIENT_TIMEOUT_MS.correct),
    run: (prompt) => request(fetchImpl, 'api/run', { method: 'POST', body: JSON.stringify({ prompt }) }, runResponseSchema, CLIENT_TIMEOUT_MS.run),
  }
}
