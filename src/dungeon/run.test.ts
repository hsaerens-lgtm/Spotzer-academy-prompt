import { parseMap } from './map'
import type { Question } from './model'
import type { Asked } from './questions'
import { reduce, startRun, type RunEvent, type RunState } from './run'

const map = parseMap({ dir: 'E', rows: ['#########', '#S..G.G.#', '#.##t##.#', '#.#i##B.#', '#########'] })
const q = (id: string): Question => ({
  id,
  type: 'choice',
  question: `${id}?`,
  answers: [
    { id: 'a', text: 'Right', correct: true },
    { id: 'b', text: 'Wrong', correct: false },
    { id: 'c', text: 'Also wrong', correct: false },
    { id: 'd', text: 'Still wrong', correct: false },
  ],
  explanation: 'A.',
})
const asked: Asked[] = [
  { question: q('one'), order: ['a', 'b', 'c', 'd'] },
  { question: q('two'), order: ['b', 'a', 'd', 'c'] },
]
const play = (state: RunState, ...events: RunEvent[]) => events.reduce((s, e) => reduce(map, s, e).state, state)
const fwd: RunEvent = { type: 'move', command: 'forward' }
const right: RunEvent = { type: 'move', command: 'turnRight' }

test('walking up to a guardian opens the encounter; it only blocks until answered', () => {
  const start = startRun(1, map, asked, 9)
  expect(start.phase).toBe('exploring')
  expect(start.hearts).toBe(3)
  const facing = play(start, fwd, fwd)
  expect(facing.pose).toEqual({ x: 3, y: 1, dir: 'E' })
  expect(facing.phase).toBe('encounter')
  expect(facing.current).toBe(0)
  expect(reduce(map, facing, fwd).state).toBe(facing)
  const answered = play(facing, { type: 'answer', picked: ['a'] })
  expect(answered.phase).toBe('answered')
  expect(answered.answers).toEqual([{ guardian: 0, picked: ['a'], correct: true }])
  const walking = play(answered, { type: 'continue' }, fwd)
  expect(walking.pose.x).toBe(4)
})

test('an encounter opens only when the player faces the guardian', () => {
  const sideways = play(startRun(1, map, asked, 9), right)
  expect(sideways.phase).toBe('exploring')
  const back = play(startRun(1, map, asked, 9), fwd, fwd, { type: 'answer', picked: ['a'] }, { type: 'continue' }, fwd, fwd)
  expect(back.phase).toBe('encounter')
  expect(back.current).toBe(1)
})

test('a wrong answer costs a heart and the guardian still goes; the last heart ejects', () => {
  let state = play(startRun(2, map, asked, 1), fwd, fwd, { type: 'answer', picked: ['b'] })
  expect(state.hearts).toBe(1)
  expect(state.defeated[0]).toBe(true)
  state = play(state, { type: 'continue' }, fwd, fwd, { type: 'answer', picked: ['c'] }, { type: 'continue' })
  expect(state.phase).toBe('ejected')
})

test('the boss: a failed attempt costs a heart, a pass wins with the score', () => {
  const guardiansDone = play(
    startRun(1, map, asked, 3),
    fwd,
    fwd,
    { type: 'answer', picked: ['a'] },
    { type: 'continue' },
    fwd,
    fwd,
    { type: 'answer', picked: ['b'] },
    { type: 'continue' },
    // (5,1) → (7,1), then south to (7,3), then a quarter turn to face the boss in (6,3).
    fwd,
    fwd,
    right,
    fwd,
    fwd,
    right,
  )
  expect(guardiansDone.phase).toBe('boss')
  const hit = play(guardiansDone, { type: 'bossResult', text: 'Write a page.', tier: 'vague', passed: false })
  expect(hit.phase).toBe('bossFeedback')
  expect(hit.hearts).toBe(1)
  const won = play(hit, { type: 'continue' }, { type: 'bossResult', text: 'A good prompt.', tier: 'excellent', passed: true })
  expect(won.phase).toBe('victory')
  expect(won.score).toBe(1 * 5 + 25)
})

test('advance (text mode) jumps in front of the next guardian, then the boss', () => {
  const first = play(startRun(1, map, asked, 3), { type: 'advance' })
  expect(first.phase).toBe('encounter')
  expect(first.current).toBe(0)
  const boss = play(
    first,
    { type: 'answer', picked: ['a'] },
    { type: 'continue' },
    { type: 'advance' },
    { type: 'answer', picked: ['a'] },
    { type: 'continue' },
    { type: 'advance' },
  )
  expect(boss.phase).toBe('boss')
})
