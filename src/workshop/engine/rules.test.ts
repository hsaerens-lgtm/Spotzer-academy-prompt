import { SCORE_BANDS, qualityFor, scoreInBand, tierFor } from './rules'

// The corrector's score out of 100 must agree with its verdict: a 95/100 that collapses would contradict itself.
test('a score out of 100 is kept inside the band of its tier', () => {
  expect(SCORE_BANDS).toEqual({ vague: [0, 39], passable: [40, 79], excellent: [80, 100] })
  expect(scoreInBand(95, 'vague')).toBe(39)
  expect(scoreInBand(12, 'vague')).toBe(12)
  expect(scoreInBand(20, 'passable')).toBe(40)
  expect(scoreInBand(62, 'passable')).toBe(62)
  expect(scoreInBand(95, 'passable')).toBe(79)
  expect(scoreInBand(30, 'excellent')).toBe(80)
  expect(scoreInBand(100, 'excellent')).toBe(100)
})

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
