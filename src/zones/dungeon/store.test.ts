import { getDungeonContent } from '../../dungeon/content'
import { correctIds, options } from '../../dungeon/questions'
import { createDungeonStore } from './store'

const content = getDungeonContent('en')
const make = () => {
  const onVictory = vi.fn()
  const onEjected = vi.fn()
  const store = createDungeonStore({ content, seed: () => 11, today: () => '2026-10-15', onVictory, onEjected })
  return { store, onVictory, onEjected }
}
type Store = ReturnType<typeof make>['store']
const answer = (store: Store, right: boolean) => {
  const run = store.getState().run!
  const q = run.asked[run.current!].question
  const ids = correctIds(q)
  const wrong = options(q)
    .map((o) => o.id)
    .find((id) => !ids.includes(id))!
  store.getState().dispatch({ type: 'answer', picked: right ? ids : [wrong] })
  store.getState().dispatch({ type: 'continue' })
}

test('three wrong answers on floor 1 eject with the missed topics', () => {
  const { store, onEjected } = make()
  store.getState().start(1)
  for (let i = 0; i < 3; i++) {
    store.getState().dispatch({ type: 'advance' })
    answer(store, false)
  }
  expect(store.getState().run!.phase).toBe('ejected')
  expect(onEjected).toHaveBeenCalledWith(1, ['what-is-ai', 'generative-ai', 'llm'])
})

test('a full floor 1 with a passing boss reports the victory once', () => {
  const { store, onVictory } = make()
  store.getState().start(1)
  for (let i = 0; i < 13; i++) {
    store.getState().dispatch({ type: 'advance' })
    answer(store, true)
  }
  store.getState().dispatch({ type: 'advance' })
  expect(store.getState().run!.phase).toBe('boss')
  store.getState().dispatch({ type: 'bossResult', text: 'x', tier: 'excellent', passed: true })
  expect(onVictory).toHaveBeenCalledTimes(1)
  expect(onVictory).toHaveBeenCalledWith(1, 100, '2026-10-15')
})

test('the seen cells grow as the player moves; quitting clears the run', () => {
  const { store } = make()
  store.getState().start(1)
  const before = store.getState().seen.size
  store.getState().dispatch({ type: 'advance' })
  expect(store.getState().seen.size).toBeGreaterThan(before)
  store.getState().quit()
  expect(store.getState().run).toBeNull()
})

test('each effect is a new event, even when the same one repeats', () => {
  const { store } = make()
  store.getState().start(1)
  store.getState().dispatch({ type: 'move', command: 'back' })
  const first = store.getState().effect
  store.getState().dispatch({ type: 'move', command: 'back' })
  const second = store.getState().effect
  expect(first?.kind).toBe('bump')
  expect(second?.kind).toBe('bump')
  expect(second?.id).not.toBe(first?.id)
})
