import { dprFor, nextQuality } from './quality'

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
