import { makeMission, makeReport } from '../test/workshopFixtures'
import { correctorReportSchema, correctRequestSchema, isCoreBlock, missionSchema, promptInputSchema } from './model'

test('a well-formed mission passes the schema', () => {
  expect(missionSchema.safeParse(makeMission()).success).toBe(true)
})

test('patterns are plain words: regular-expression characters are refused', () => {
  const mission = makeMission()
  mission.blocks.role.details[0].patterns = ['(you|we) are']
  expect(missionSchema.safeParse(mission).success).toBe(false)
})

test('a trailing star is the only wildcard allowed', () => {
  const ok = makeMission()
  ok.blocks.context.details[0].patterns = ['martin*', '24/7', '15%', "don't", 'e.g.', 'small-business']
  expect(missionSchema.safeParse(ok).success).toBe(true)
  const bad = makeMission()
  bad.blocks.context.details[0].patterns = ['mar*tin']
  expect(missionSchema.safeParse(bad).success).toBe(false)
})

test('emoji are refused in any text', () => {
  expect(missionSchema.safeParse(makeMission({ title: 'Hello \u{1F600}' })).success).toBe(false)
})

test('prompt inputs are told apart by their mode', () => {
  expect(promptInputSchema.safeParse({ mode: 'blocks', blocks: { role: 'x' } }).success).toBe(true)
  expect(promptInputSchema.safeParse({ mode: 'free', text: 'x' }).success).toBe(true)
  expect(promptInputSchema.safeParse({ mode: 'free', blocks: {} }).success).toBe(false)
})

test('a corrector report needs exactly one entry per block type', () => {
  expect(correctorReportSchema.safeParse(makeReport()).success).toBe(true)
  const report = makeReport()
  report.blocks[5] = { ...report.blocks[4] }
  expect(correctorReportSchema.safeParse(report).success).toBe(false)
})

test('a correction request trims and bounds the prompt', () => {
  expect(correctRequestSchema.safeParse({ prompt: '   ', lang: 'en' }).success).toBe(false)
  expect(correctRequestSchema.safeParse({ prompt: 'x'.repeat(4001), lang: 'en' }).success).toBe(false)
  expect(correctRequestSchema.parse({ prompt: '  Hi  ', lang: 'en' }).prompt).toBe('Hi')
})

test('only the four structural blocks are core blocks', () => {
  expect(isCoreBlock('role')).toBe(true)
  expect(isCoreBlock('task')).toBe(true)
  expect(isCoreBlock('context')).toBe(true)
  expect(isCoreBlock('format')).toBe(true)
  expect(isCoreBlock('example')).toBe(false)
  expect(isCoreBlock('constraint')).toBe(false)
})
