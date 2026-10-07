// @vitest-environment node
import { makeBlocksFile, makeReport } from '../src/test/workshopFixtures'
import { readConfig } from './config.ts'
import { REPORT_JSON_SCHEMA, correctPrompt, parseReport } from './correct.ts'
import { callOpenAI, type CallOptions, type CallResult, type FetchLike } from './openai.ts'
import { runPrompt } from './run.ts'

const config = readConfig({ OPENAI_API_KEY: 'test-key' })
const deps = (call: (options: CallOptions) => Promise<CallResult>) => ({ config, apiKey: 'test-key', blocks: makeBlocksFile(), call })
const request = { prompt: 'Write a post', lang: 'en' as const }

test('returns the report with blocks in order and a verdict that follows the workshop rules', async () => {
  const report = makeReport()
  const call = vi.fn(async (_options: CallOptions) => ({
    ok: true as const,
    text: JSON.stringify({ ...report, blocks: [...report.blocks].reverse(), verdict: 'holds' }),
  }))
  const result = await correctPrompt(request, deps(call))
  expect(result.ok && result.report.blocks.map((b) => b.type)).toEqual(['role', 'task', 'context', 'format', 'example', 'constraint'])
  expect(result.ok && result.report.verdict).toBe('leans')
  expect(call.mock.calls[0][0]).toMatchObject({ model: config.model, maxOutputTokens: 4000, jsonSchema: { name: 'prompt_building_report' } })
})

test('retries once after an answer that is not a valid report', async () => {
  const call = vi.fn().mockResolvedValueOnce({ ok: true, text: '{"nope":1}' }).mockResolvedValueOnce({ ok: true, text: JSON.stringify(makeReport()) })
  expect((await correctPrompt(request, deps(call))).ok).toBe(true)
  expect(call).toHaveBeenCalledTimes(2)
})

test('gives up after two invalid answers, and retries an incomplete one', async () => {
  const call = vi.fn().mockResolvedValueOnce({ ok: false, error: 'incomplete' }).mockResolvedValueOnce({ ok: true, text: 'not json' })
  expect(await correctPrompt(request, deps(call))).toEqual({ ok: false, error: 'error' })
  expect(call).toHaveBeenCalledTimes(2)
})

test('a timeout or an unreachable AI is reported at once', async () => {
  expect(await correctPrompt(request, deps(async () => ({ ok: false, error: 'timeout' })))).toEqual({ ok: false, error: 'timeout' })
  expect(await correctPrompt(request, deps(async () => ({ ok: false, error: 'upstream' })))).toEqual({ ok: false, error: 'unavailable' })
})

test('a report with a missing block is refused', () => {
  const report = makeReport()
  expect(parseReport(JSON.stringify({ ...report, blocks: report.blocks.slice(0, 5) }))).toBeNull()
})

test('the JSON schema requires every field the report needs', () => {
  expect(REPORT_JSON_SCHEMA.required).toEqual(['score', 'verdict', 'summary', 'blocks', 'conflicts', 'improvedPrompt', 'changes'])
  expect(REPORT_JSON_SCHEMA.additionalProperties).toBe(false)
})

test('running a prompt returns the answer, errors are mapped', async () => {
  expect(await runPrompt('Hi', deps(async () => ({ ok: true, text: 'Hello!' })))).toEqual({ ok: true, answer: 'Hello!' })
  expect(await runPrompt('Hi', deps(async () => ({ ok: false, error: 'timeout' })))).toEqual({ ok: false, error: 'timeout' })
  expect(await runPrompt('Hi', deps(async () => ({ ok: false, error: 'upstream' })))).toEqual({ ok: false, error: 'unavailable' })
  expect(await runPrompt('Hi', deps(async () => ({ ok: false, error: 'refused' })))).toEqual({ ok: false, error: 'error' })
  expect(await runPrompt('Hi', deps(async () => ({ ok: false, error: 'incomplete' })))).toEqual({ ok: false, error: 'error' })
})

// Spec 3.9: "Run both" answers are capped; one cut at the cap is shown, marked as cut.
test('running a prompt accepts an answer cut at the cap and says it was cut', async () => {
  const call = vi.fn(async (_options: CallOptions): Promise<CallResult> => ({ ok: true, text: 'Dear Martin, the launch', truncated: true }))
  expect(await runPrompt('Hi', deps(call))).toEqual({ ok: true, answer: 'Dear Martin, the launch', truncated: true })
  expect(call.mock.calls[0][0]).toMatchObject({ maxOutputTokens: config.maxOutputRun, acceptTruncated: true })
})

// Through the real callOpenAI: a fake fetch answers as the Responses API does when the cap is reached.
test('runPrompt over callOpenAI returns the text OpenAI wrote before the cap', async () => {
  const incomplete = {
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'Dear Martin, the launch' }] }],
  }
  const fetchImpl: FetchLike = async () => new Response(JSON.stringify(incomplete), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const result = await runPrompt('Hi', deps((options) => callOpenAI(options, fetchImpl)))
  expect(result).toEqual({ ok: true, answer: 'Dear Martin, the launch', truncated: true })
  // A check never takes a cut report: the same answer is an incomplete call, retried, then an error.
  expect(await correctPrompt(request, deps((options) => callOpenAI(options, fetchImpl)))).toEqual({ ok: false, error: 'error' })
})
