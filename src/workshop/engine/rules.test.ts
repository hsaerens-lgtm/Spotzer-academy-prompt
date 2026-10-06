import { qualityFor, tierFor } from './rules'

test('quality follows the share of expected details that are present', () => {
  expect(qualityFor(0, 3, false)).toBe(0)
  expect(qualityFor(0, 3, true)).toBe(1)
  expect(qualityFor(1, 3, true)).toBe(1)
  expect(qualityFor(2, 3, true)).toBe(2)
  expect(qualityFor(1, 2, true)).toBe(2)
  expect(qualityFor(3, 3, true)).toBe(3)
})

test('a hole or a weak average makes a vague prompt', () => {
  expect(tierFor([3, 3, 0, 3], false)).toBe('vague')
  expect(tierFor([2, 1, 1, 1], false)).toBe('vague')
  expect(tierFor([], false)).toBe('vague')
})

test('excellent needs stone everywhere and no crack', () => {
  expect(tierFor([3, 3, 3, 3], false)).toBe('excellent')
  expect(tierFor([3, 3, 3, 3], true)).toBe('passable')
  expect(tierFor([3, 3, 1, 2], false)).toBe('passable')
  expect(tierFor([3, 1, 1, 1], false)).toBe('passable')
})
