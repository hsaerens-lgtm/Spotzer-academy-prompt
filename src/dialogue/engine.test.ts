import { makeTopic } from '../test/fixtures'
import { advance, choicesFor, chooseDeeper, currentBeat, finishTyping, screenAt, start } from './engine'

const topic = makeTopic({ next: 'beta' })

function runToChoices(state = start(topic)) {
  let current = state
  let completed = null
  for (let i = 0; i < 20 && current.phase !== 'choices'; i++) {
    const result = advance(current, topic)
    current = result.state
    completed = result.completed ?? completed
  }
  return { state: current, completed }
}

test('starts typing the first basics beat', () => {
  expect(start(topic)).toEqual({ topicId: 'alpha', section: 'basics', beatIndex: 0, phase: 'typing' })
  expect(currentBeat(start(topic), topic).say).toBe('Basics one.')
})

test('advance first reveals the whole line, then moves on', () => {
  const revealed = advance(start(topic), topic)
  expect(revealed.state.phase).toBe('waiting')
  expect(revealed.state.beatIndex).toBe(0)
  const next = advance(revealed.state, topic)
  expect(next.state).toMatchObject({ beatIndex: 1, phase: 'typing' })
})

test('finishTyping only affects the typing phase', () => {
  const waiting = finishTyping(start(topic))
  expect(waiting.phase).toBe('waiting')
  expect(finishTyping(waiting)).toBe(waiting)
})

test('the last beat leads to choices and reports completion once', () => {
  const { state, completed } = runToChoices()
  expect(state.phase).toBe('choices')
  expect(completed).toEqual({ topicId: 'alpha', section: 'basics' })
  expect(advance(state, topic)).toEqual({ state, completed: null })
})

test('choices after basics: deeper, next, all', () => {
  const { state } = runToChoices()
  expect(choicesFor(state, topic, new Set(['alpha', 'beta']))).toEqual([
    { kind: 'deeper' },
    { kind: 'next', topicId: 'beta' },
    { kind: 'all' },
  ])
  expect(choicesFor(state, topic, new Set(['alpha']))).toEqual([{ kind: 'deeper' }, { kind: 'all' }])
  expect(choicesFor(start(topic), topic, new Set(['alpha']))).toEqual([])
})

test('go deeper, then the deeper section completes', () => {
  const { state } = runToChoices()
  const deeper = chooseDeeper(state, topic)
  expect(deeper).toEqual({ topicId: 'alpha', section: 'deeper', beatIndex: 0, phase: 'typing' })
  const done = runToChoices(deeper)
  expect(done.completed).toEqual({ topicId: 'alpha', section: 'deeper' })
  expect(choicesFor(done.state, topic, new Set(['alpha', 'beta']))).toEqual([
    { kind: 'next', topicId: 'beta' },
    { kind: 'all' },
  ])
  expect(chooseDeeper(done.state, topic)).toBe(done.state)
})

test('chooseDeeper is ignored before the choices phase', () => {
  const typing = start(topic)
  expect(chooseDeeper(typing, topic)).toBe(typing)
})

test('the screen keeps the last visual step set so far', () => {
  const s0 = start(topic)
  expect(screenAt(s0, topic)).toEqual({ visualId: 'what-is-ai', step: 1 })
  expect(screenAt({ ...s0, beatIndex: 1 }, topic)).toEqual({ visualId: 'what-is-ai', step: 1 })
  expect(screenAt({ ...s0, beatIndex: 2 }, topic)).toEqual({ visualId: 'what-is-ai', step: 2 })
  const deeper = { ...s0, section: 'deeper' as const, beatIndex: 0 }
  expect(screenAt(deeper, topic)).toEqual({ visualId: 'what-is-ai', step: 2 })
  expect(screenAt({ ...deeper, beatIndex: 1 }, topic)).toEqual({ visualId: 'what-is-ai', step: 4 })
})
