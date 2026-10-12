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

// Spec 3.9, "Run both": the answers are capped. An answer cut at the cap is still an answer, for a caller that takes one.
test('an answer cut at max_output_tokens is returned as truncated, only to a caller that accepts it', async () => {
  const capped = (text: string) => ({
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
    output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text }] }],
  })
  const run = { ...options, jsonSchema: undefined, acceptTruncated: true }
  const fetchMock = vi.fn<FetchLike>(async () => reply(capped('Dear Martin, the launch')))
  expect(await callOpenAI(run, fetchMock)).toEqual({ ok: true, text: 'Dear Martin, the launch', truncated: true })
  // Never sent to OpenAI: it is about how the answer is read.
  expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).not.toHaveProperty('acceptTruncated')
  // A report cut short is no report.
  expect(await callOpenAI(options, async () => reply(capped('{"score":')))).toEqual({ ok: false, error: 'incomplete' })
  // Nothing written before the cap (all of it spent on reasoning), or cut for another reason: still incomplete.
  expect(await callOpenAI(run, async () => reply(capped('')))).toEqual({ ok: false, error: 'incomplete' })
  const filtered = { ...capped('Dear'), incomplete_details: { reason: 'content_filter' } }
  expect(await callOpenAI(run, async () => reply(filtered))).toEqual({ ok: false, error: 'incomplete' })
  const refused = { ...capped(''), output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }] }
  expect(await callOpenAI(run, async () => reply(refused))).toEqual({ ok: false, error: 'refused' })
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
