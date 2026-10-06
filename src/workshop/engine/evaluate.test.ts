import { makeMission } from '../../test/workshopFixtures'
import type { PromptInput } from '../model'
import { adviceFor, assemblePrompt, blockResult, evaluate, isBlank, nextTip, wordCount } from './evaluate'

const mission = makeMission()
const blocks = (b: Partial<Record<string, string>>): PromptInput => ({ mode: 'blocks', blocks: b })
const full = {
  role: 'You are an account manager',
  task: 'Write an email',
  context: 'Martin, photos late, next Friday',
  format: 'Friendly, 100 words',
}

test('an empty block field is a hole', () => {
  const evaluation = evaluate(mission, blocks({ task: 'Write an email' }))
  expect(blockResult(evaluation, 'role')).toMatchObject({ present: false, quality: 0 })
  expect(evaluation.tier).toBe('vague')
  expect(evaluation.weakest).toBe('role')
})

test('text without any expected detail is cardboard, partial is wood, complete is stone', () => {
  const evaluation = evaluate(mission, blocks({ ...full, context: 'The site is late', format: 'Friendly' }))
  expect(blockResult(evaluation, 'context').quality).toBe(1)
  expect(blockResult(evaluation, 'format').quality).toBe(2)
  expect(blockResult(evaluation, 'role').quality).toBe(3)
  expect(evaluation.tier).toBe('passable')
  expect(evaluation.weakest).toBe('context')
})

test('every expected detail in every structural block passes the mission', () => {
  const evaluation = evaluate(mission, blocks(full))
  expect(evaluation.tier).toBe('excellent')
  expect(evaluation.passed).toBe(true)
  expect(evaluation.weakest).toBeNull()
})

test('in block mode a detail only counts inside its own block', () => {
  const evaluation = evaluate(mission, blocks({ ...full, context: 'Friday', task: 'Write an email to Martin about the photos' }))
  expect(blockResult(evaluation, 'context').details.map((d) => d.met)).toEqual([false, false, true])
})

test('two clashing instructions crack the block and block the pass', () => {
  const evaluation = evaluate(mission, blocks({ ...full, format: 'Friendly, short and detailed' }))
  expect(blockResult(evaluation, 'format')).toMatchObject({ quality: 3, cracked: true })
  expect(evaluation.conflicts).toEqual(['length-clash'])
  expect(evaluation.tier).toBe('passable')
  expect(evaluation.weakest).toBe('format')
})

test('"It\'s already there" counts a detail as met', () => {
  const input = blocks({ ...full, context: 'Martin, photos late, the new launch day' })
  expect(evaluate(mission, input).passed).toBe(false)
  const evaluation = evaluate(mission, input, new Set(['new-date']))
  expect(blockResult(evaluation, 'context').details[2]).toMatchObject({ met: true, source: 'override' })
  expect(evaluation.passed).toBe(true)
})

test('in free text, blocks are rebuilt from the sentences that mention them', () => {
  const text = 'You are an account manager. Write an email to Martin. The photos were late, launch next Friday. Keep it friendly, 100 words.'
  const evaluation = evaluate(mission, { mode: 'free', text })
  expect(evaluation.source).toBe('text')
  expect(evaluation.tier).toBe('excellent')
  const context = blockResult(evaluation, 'context')
  expect(context.spans.map((s) => text.slice(s.start, s.end))).toEqual([
    'Write an email to Martin.',
    'The photos were late, launch next Friday.',
  ])
})

test('in free text, a block nobody mentions is a hole', () => {
  const evaluation = evaluate(mission, { mode: 'free', text: 'Write an email to Martin.' })
  expect(blockResult(evaluation, 'role').present).toBe(false)
  expect(evaluation.tier).toBe('vague')
})

test('optional blocks never decide the tier', () => {
  const evaluation = evaluate(mission, blocks(full))
  expect(blockResult(evaluation, 'example')).toMatchObject({ required: false, quality: 0 })
  expect(evaluation.tier).toBe('excellent')
})

test('advice names the weakest block and its first missing detail', () => {
  expect(adviceFor(mission, evaluate(mission, blocks({ task: 'Write an email' })))).toMatchObject({ kind: 'hole', block: 'role' })
  const weak = adviceFor(mission, evaluate(mission, blocks({ ...full, context: 'Martin' })))
  expect(weak).toMatchObject({ kind: 'weak', block: 'context', quality: 1 })
  expect(weak.kind === 'weak' && weak.detail.id).toBe('reason')
  expect(adviceFor(mission, evaluate(mission, blocks({ ...full, format: 'Friendly, short and detailed' })))).toMatchObject({
    kind: 'cracked',
    block: 'format',
  })
  expect(adviceFor(mission, evaluate(mission, blocks(full)))).toEqual({ kind: 'success' })
})

test('live tips point at the first hole or cardboard block, once per detail', () => {
  const evaluation = evaluate(mission, { mode: 'free', text: 'Write an email to Martin about the photos, next Friday.' })
  const first = nextTip(mission, evaluation, new Set())
  expect(first).toMatchObject({ block: 'role', detail: { id: 'role-job' } })
  expect(nextTip(mission, evaluation, new Set(['role-job']))).toMatchObject({ block: 'format', detail: { id: 'tone' } })
})

test('assembling labels each filled block, free text is kept as typed', () => {
  const labels = { role: 'Role', task: 'Task', context: 'Context', format: 'Format', example: 'Example', constraint: 'Constraint' }
  expect(assemblePrompt(blocks({ role: ' You are a writer ', format: 'Short' }), labels)).toBe('Role: You are a writer\nFormat: Short')
  expect(assemblePrompt({ mode: 'free', text: '  Hello  ' }, labels)).toBe('Hello')
})

test('blank inputs and word counts', () => {
  expect(isBlank(blocks({ role: '  ' }))).toBe(true)
  expect(isBlank({ mode: 'fix', text: 'x' })).toBe(false)
  expect(wordCount("  you're   a\nwriter ")).toBe(3)
})

// Review focus 1: a long pasted prompt stays fast and its highlights land on the right sentence.
test('long pasted prompts evaluate quickly and map back to the right sentence', () => {
  const filler = 'Ceci est une phrase de remplissage, avec des accents et des \u2018guillemets\u2019. '.repeat(40)
  const text = `${filler}You are an account manager.\n\nWrite an email to Mart\u00EDn. ${filler}`
  const started = performance.now()
  const evaluation = evaluate(mission, { mode: 'free', text })
  expect(performance.now() - started).toBeLessThan(50)
  const role = blockResult(evaluation, 'role')
  expect(text.slice(role.spans[0].start, role.spans[0].end)).toBe('You are an account manager.')
  const client = blockResult(evaluation, 'context').spans[0]
  expect(text.slice(client.start, client.end)).toBe('Write an email to Mart\u00EDn.')
})
