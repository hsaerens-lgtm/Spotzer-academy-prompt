// @vitest-environment node
import { RESPONSES_URL, callOpenAI, type CallOptions, type FetchLike } from './openai.ts'

const options: CallOptions = {
  apiKey: 'test-key',
  model: 'gpt-5.4-nano',
  instructions: 'Inspect.',
  input: 'Hello',
  maxOutputTokens: 100,
  timeoutMs: 1000,
  reasoningEffort: null,
  jsonSchema: { name: 'report', schema: { type: 'object' } },
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const completed = (text: string) => ({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text }] }] })

test('posts a strict JSON-schema request that is not stored, and returns the text', async () => {
  const fetchMock = vi.fn<FetchLike>(async () => reply(completed('{"ok":true}')))
  expect(await callOpenAI(options, fetchMock)).toEqual({ ok: true, text: '{"ok":true}' })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe(RESPONSES_URL)
  expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key', 'Content-Type': 'application/json' })
  expect(JSON.parse(init.body as string)).toEqual({
    model: 'gpt-5.4-nano',
    input: 'Hello',
    instructions: 'Inspect.',
    max_output_tokens: 100,
    store: false,
    text: { format: { type: 'json_schema', name: 'report', strict: true, schema: { type: 'object' } } },
  })
})

test('the reasoning effort is sent only when configured', async () => {
  const fetchMock = vi.fn<FetchLike>(async () => reply(completed('x')))
  await callOpenAI({ ...options, reasoningEffort: 'low', jsonSchema: undefined, instructions: undefined }, fetchMock)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
    model: 'gpt-5.4-nano',
    input: 'Hello',
    max_output_tokens: 100,
    store: false,
    reasoning: { effort: 'low' },
  })
})

test('an incomplete or refused answer is reported as such', async () => {
  expect(await callOpenAI(options, async () => reply({ status: 'incomplete', output: [] }))).toEqual({ ok: false, error: 'incomplete' })
  const refusal = { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }] }
  expect(await callOpenAI(options, async () => reply(refusal))).toEqual({ ok: false, error: 'refused' })
})

test('an HTTP error or a network failure is an upstream error', async () => {
  expect(await callOpenAI(options, async () => reply({ error: { message: 'bad key' } }, 401))).toEqual({ ok: false, error: 'upstream' })
  expect(await callOpenAI(options, async () => Promise.reject(new Error('offline')))).toEqual({ ok: false, error: 'upstream' })
})

test('a slow answer times out', async () => {
  const hanging: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
  expect(await callOpenAI({ ...options, timeoutMs: 20 }, hanging)).toEqual({ ok: false, error: 'timeout' })
})
