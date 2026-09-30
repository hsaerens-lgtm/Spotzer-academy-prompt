import { INITIAL_QUALITY, dprFor, nextQuality, reduceQuality, type QualityState } from './quality'

test('declining lowers the resolution first, then drops shadows', () => {
  expect(nextQuality('high', 'decline')).toBe('medium')
  expect(nextQuality('medium', 'decline')).toBe('low')
  expect(nextQuality('low', 'decline')).toBe('low')
})

test('inclining climbs back, fallback goes straight to low', () => {
  expect(nextQuality('low', 'incline')).toBe('medium')
  expect(nextQuality('medium', 'incline')).toBe('high')
  expect(nextQuality('high', 'fallback')).toBe('low')
})

test('pixel ratio per level', () => {
  expect(dprFor('high')).toEqual([1, 1.5])
  expect(dprFor('medium')).toBe(1)
  expect(dprFor('low')).toBe(1)
})

test('a fast machine keeps high quality however often it reports an incline', () => {
  let state: QualityState = INITIAL_QUALITY
  for (let i = 0; i < 20; i++) state = reduceQuality(state, 'incline')
  expect(state).toEqual({ level: 'high', changes: 0, settled: false })
  expect(state).toBe(INITIAL_QUALITY)
})

test('sustained declines step down to low, then stay there without settling', () => {
  let state: QualityState = INITIAL_QUALITY
  const levels: string[] = []
  for (let i = 0; i < 20; i++) {
    state = reduceQuality(state, 'decline')
    levels.push(state.level)
  }
  expect(levels.slice(0, 3)).toEqual(['medium', 'low', 'low'])
  expect(new Set(levels)).toEqual(new Set(['medium', 'low']))
  expect(state).toEqual({ level: 'low', changes: 2, settled: false })
})

test('flip-flopping between levels settles on low for good', () => {
  let state: QualityState = INITIAL_QUALITY
  for (const event of ['decline', 'incline', 'decline', 'incline'] as const) state = reduceQuality(state, event)
  expect(state).toMatchObject({ level: 'low', settled: true })
  const settled = state
  expect(reduceQuality(settled, 'incline')).toBe(settled)
  expect(reduceQuality(settled, 'decline')).toBe(settled)
})
