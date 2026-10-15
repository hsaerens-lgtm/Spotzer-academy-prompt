import { seeded, shuffled } from './random'

test('the same seed gives the same numbers, in [0, 1)', () => {
  const a = seeded(42)
  const b = seeded(42)
  const values = Array.from({ length: 50 }, () => a())
  expect(values).toEqual(Array.from({ length: 50 }, () => b()))
  for (const value of values) expect(value >= 0 && value < 1).toBe(true)
  expect(seeded(43)()).not.toBe(seeded(42)())
})

test('shuffled keeps every item and leaves the input alone', () => {
  const items = [1, 2, 3, 4, 5, 6]
  const out = shuffled(items, seeded(7))
  expect([...out].sort()).toEqual(items)
  expect(items).toEqual([1, 2, 3, 4, 5, 6])
})
