// @vitest-environment node
import { makeBlocksFile, makeReport } from '../src/test/workshopFixtures'
import { readConfig } from './config.ts'
import { REPORT_JSON_SCHEMA, correctPrompt, parseReport } from './correct.ts'
import type { CallOptions, CallResult } from './openai.ts'
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
})
