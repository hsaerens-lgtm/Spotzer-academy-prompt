import { makeReport } from '../../../test/workshopFixtures'
import { CLIENT_TIMEOUT_MS, createCorrectorApi } from './api'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => vi.useRealTimers())

test('asks the server for its health on a relative path', async () => {
  const fetchMock = vi.fn(async () => json({ corrector: true }))
  expect(await createCorrectorApi(fetchMock).health()).toEqual({ ok: true, data: { corrector: true } })
  expect(fetchMock).toHaveBeenCalledWith('api/health', expect.objectContaining({ method: 'GET' }))
})

test('posts the prompt and validates the report', async () => {
  const fetchMock = vi.fn(async () => json(makeReport()))
  const result = await createCorrectorApi(fetchMock).correct({ prompt: 'Write', lang: 'en' })
  expect(result).toEqual({ ok: true, data: makeReport() })
  const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(path).toBe('api/correct')
  expect(JSON.parse(init.body as string)).toEqual({ prompt: 'Write', lang: 'en' })
})

test('maps errors from the body, the status or the network', async () => {
  expect(await createCorrectorApi(async () => json({ error: 'rate' }, 429)).run('Hi')).toEqual({ ok: false, error: 'rate' })
  expect(await createCorrectorApi(async () => new Response('<html>Bad gateway</html>', { status: 502 })).run('Hi')).toEqual({ ok: false, error: 'unavailable' })
  expect(await createCorrectorApi(async () => Promise.reject(new Error('offline'))).run('Hi')).toEqual({ ok: false, error: 'unavailable' })
  expect(await createCorrectorApi(async () => json({ unexpected: true })).run('Hi')).toEqual({ ok: false, error: 'error' })
})

test('a page instead of JSON is an error, and an error code it does not know falls back to the status', async () => {
  // A static host answering every path with its index page.
  const page = async () => new Response('<!doctype html><title>Athena</title>', { status: 200, headers: { 'Content-Type': 'text/html' } })
  expect(await createCorrectorApi(page).health()).toEqual({ ok: false, error: 'error' })
  expect(await createCorrectorApi(page).correct({ prompt: 'Write', lang: 'en' })).toEqual({ ok: false, error: 'error' })
  expect(await createCorrectorApi(async () => json({ error: 'busy' }, 429)).run('Hi')).toEqual({ ok: false, error: 'rate' })
  expect(await createCorrectorApi(async () => json({ error: 'teapot' }, 503)).run('Hi')).toEqual({ ok: false, error: 'unavailable' })
  expect(await createCorrectorApi(async () => json({ error: 'teapot' }, 418)).run('Hi')).toEqual({ ok: false, error: 'error' })
})

test('sends a JSON Content-Type with a body only', async () => {
  const fetchMock = vi.fn(async (path: string) => (path === 'api/health' ? json({ corrector: true }) : json({ answer: 'Hello' })))
  const api = createCorrectorApi(fetchMock as unknown as typeof fetch)
  await api.health()
  await api.run('Hi')
  const [[, get], [, post]] = fetchMock.mock.calls as unknown as [string, RequestInit][]
  expect(get).toMatchObject({ method: 'GET', headers: { Accept: 'application/json' } })
  expect(get.headers).not.toHaveProperty('Content-Type')
  expect(post).toMatchObject({ method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
})

test('gives up with "timeout" a little after the server would have, and leaves no timer behind', async () => {
  vi.useFakeTimers()
  // Never answers: only the abort signal ends it, as a real fetch does.
  const hanging = (_path: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
  let result: unknown = null
  void createCorrectorApi(hanging)
    .run('Hi')
    .then((value) => (result = value))
  await vi.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS.run - 1)
  expect(result).toBeNull()
  await vi.advanceTimersByTimeAsync(1)
  expect(result).toEqual({ ok: false, error: 'timeout' })
  expect(CLIENT_TIMEOUT_MS.run).toBeGreaterThan(30_000)
  // A check may take two AI calls on the server.
  expect(CLIENT_TIMEOUT_MS.correct).toBeGreaterThan(2 * 30_000)

  await createCorrectorApi(async () => json({ answer: 'Hello' })).run('Hi')
  expect(vi.getTimerCount()).toBe(0)
})
