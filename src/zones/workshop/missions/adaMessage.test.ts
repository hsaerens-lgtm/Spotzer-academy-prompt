import { i18n } from '../../../core/i18n'
import { makeMission } from '../../../test/workshopFixtures'
import { evaluate } from '../../../workshop/engine/evaluate'
import type { PromptInput } from '../../../workshop/model'
import type { Attempt } from '../store'
import { adaMessage } from './adaMessage'

const mission = makeMission()
const labels = { role: 'Role', task: 'Task', context: 'Context', format: 'Format', example: 'Example', constraint: 'Constraint' }
const attempt = (blocks: Record<string, string>, id = 1): Attempt => {
  const input: PromptInput = { mode: 'blocks', blocks }
  return { id, input, evaluation: evaluate(mission, input) }
}
const full = { role: 'You are an account manager', task: 'Write an email', context: 'Martin, photos late, next Friday', format: 'Friendly, 100 words' }
const base = { mission, attempt: null, revealed: false, tip: null, sorry: null, allDone: false, labels, t: i18n.t }

test('before any test, Ada introduces the mission', () => {
  expect(adaMessage(base)).toEqual({ text: 'Fill in the blocks.', mood: 'happy', pointing: false, actions: [] })
})

test('while the building is read, Ada waits', () => {
  expect(adaMessage({ ...base, attempt: attempt(full) }).text).toBe('The AI is reading your building…')
})

test('a hole is named with its hint', () => {
  const message = adaMessage({ ...base, attempt: attempt({ task: 'Write an email' }), revealed: true })
  expect(message).toEqual({
    text: "There's a hole in the building: the Role block is missing. Give the AI a job.",
    mood: 'surprised',
    pointing: true,
    actions: ['edit', 'alreadyThere'],
  })
})

test('a weak block names its material', () => {
  const message = adaMessage({ ...base, attempt: attempt({ ...full, context: 'Martin' }), revealed: true })
  expect(message.text).toBe('The Context block is only cardboard. Say why it is late.')
})

test('a crack explains the clash', () => {
  const message = adaMessage({ ...base, attempt: attempt({ ...full, format: 'Friendly, short and detailed' }), revealed: true })
  expect(message).toMatchObject({ text: 'The Format block cracked. Short or detailed? Pick one.', actions: ['edit'] })
})

test('success adds the takeaway, the bonus and the final congratulations', () => {
  const message = adaMessage({ ...base, attempt: attempt({ ...full, constraint: "Don't blame them" }), revealed: true, allDone: true })
  expect(message.text).toBe(
    "It holds! Context matters. Bonus points: your extra blocks reinforce the building. All six missions done! When you're ready, the old console in the office will test what you've learned.",
  )
  expect(message.actions).toEqual(['next', 'compare'])
})

test('a live tip speaks like Clippy and can be muted', () => {
  const tip = { block: 'role' as const, detail: mission.blocks.role.details[0] }
  expect(adaMessage({ ...base, tip })).toEqual({
    text: "It looks like you're writing a prompt! Give the AI a job.",
    mood: 'thinking',
    pointing: true,
    actions: ['notNow'],
  })
})

test('after "It\'s already there", Ada apologises before the new result', () => {
  const sorry = mission.blocks.context.details[2]
  const message = adaMessage({ ...base, attempt: attempt(full), revealed: true, sorry })
  expect(message.text.startsWith('Sorry, I missed it! I was looking for something like "friday". It holds!')).toBe(true)
})

test('the starter prompt of a fix mission gets the mission intro once read', () => {
  const fix = makeMission({ mode: 'fix', level: 3, starter: 'Write.', ada: { intro: 'Fix it.', success: 'Yes.', takeaway: 'Ok.' } })
  const input: PromptInput = { mode: 'fix', text: 'Write.' }
  const starter = { id: 0, input, evaluation: evaluate(fix, input) }
  expect(adaMessage({ ...base, mission: fix, attempt: starter, revealed: true }).text).toBe('Fix it.')
})
