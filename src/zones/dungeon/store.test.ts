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

// Deferred minor: the minimap only learns cells that are on the map and in sight (not through a wall).
test('the seen cells stay on the map and never pass a wall', () => {
  const { store } = make()
  store.getState().start(1)
  const run = store.getState().run!
  const { map } = content.floors[1]
  // On the right end of floor 1's first corridor, facing north: a wall ahead, the map's edge two cells ahead.
  store.setState({ run: { ...run, pose: { x: 13, y: 1, dir: 'N' } }, seen: new Set() })
  store.getState().dispatch({ type: 'move', command: 'turnRight' })
  const seen = [...store.getState().seen]
  for (const key of seen) expect(key, `cell ${key}`).toBeLessThan(map.width * map.height)
  // Facing east from (13, 1): (14, 1) is the edge wall; (15, 1) does not exist and must not wrap to (0, 2).
  expect(seen).not.toContain(2 * map.width + 0)
  // Facing south from (13, 1): (13, 2) is the corridor down; facing west from (2, 4) through no wall is fine, but a
  // cell behind a wall is never seen.
  store.setState({ run: { ...store.getState().run!, pose: { x: 6, y: 1, dir: 'E' } }, seen: new Set() })
  store.getState().dispatch({ type: 'move', command: 'turnRight' })
  // From (6, 1) facing south: (6, 2) is an alcove, (6, 3) its inscription wall: both seen; (6, 4) behind it is not.
  expect(store.getState().seen.has(4 * map.width + 6)).toBe(false)
})

// Deferred minor: a pass is dated in local time, not UTC (half past midnight in Belgium is already the next day).
test('a victory is dated with the local day', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    vi.setSystemTime(new Date(2026, 9, 16, 0, 30))
    const onVictory = vi.fn()
    const store = createDungeonStore({ content, seed: () => 11, onVictory, onEjected: vi.fn() })
    store.getState().start(1)
    const run = store.getState().run!
    store.setState({ run: { ...run, defeated: run.defeated.map(() => true), phase: 'boss' } })
    store.getState().dispatch({ type: 'bossResult', text: 'x', tier: 'excellent', passed: true })
    expect(onVictory).toHaveBeenCalledWith(1, 35, '2026-10-16')
  } finally {
    vi.useRealTimers()
  }
})
