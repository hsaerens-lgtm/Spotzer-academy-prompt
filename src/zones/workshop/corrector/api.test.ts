import { makeReport } from '../../../test/workshopFixtures'
import { createCorrectorApi } from './api'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

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
