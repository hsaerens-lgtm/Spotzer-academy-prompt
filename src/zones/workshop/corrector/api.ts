import type { ZodType } from 'zod'
import { apiErrorSchema, correctorReportSchema, healthSchema, runResponseSchema, type ApiError } from '../../../workshop/model'
import type { ApiResult, CorrectorApi } from '../store'

const errorForStatus = (status: number): ApiError =>
  status === 429 ? 'rate' : status === 504 ? 'timeout' : status === 400 || status === 413 ? 'invalid' : status >= 500 || status === 404 ? 'unavailable' : 'error'

async function request<T>(fetchImpl: typeof fetch, path: string, init: RequestInit, schema: ZodType<T>): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetchImpl(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    })
  } catch {
    return { ok: false, error: 'unavailable' }
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body)
    return { ok: false, error: error.success ? error.data.error : errorForStatus(response.status) }
  }
  const parsed = schema.safeParse(body)
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'error' }
}

/** The corrector's server, on the site's own origin (relative paths work from any folder). */
export function createCorrectorApi(fetchImpl: typeof fetch = (...args) => fetch(...args)): CorrectorApi {
  return {
    health: () => request(fetchImpl, 'api/health', { method: 'GET' }, healthSchema),
    correct: (body) => request(fetchImpl, 'api/correct', { method: 'POST', body: JSON.stringify(body) }, correctorReportSchema),
    run: (prompt) => request(fetchImpl, 'api/run', { method: 'POST', body: JSON.stringify({ prompt }) }, runResponseSchema),
  }
}
