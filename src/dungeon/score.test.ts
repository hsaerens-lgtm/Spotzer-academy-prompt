import { RULES, bossPoints, finalScore } from './score'

test('a perfect run scores 100 on both floors', () => {
  expect(finalScore(1, 13, 1)).toBe(100)
  expect(finalScore(2, 15, 1)).toBe(100)
})

test('later boss attempts are worth less, and nothing past the last', () => {
  expect([1, 2, 3, 4].map((n) => bossPoints(1, n))).toEqual([35, 25, 15, 0])
  expect([1, 2, 3].map((n) => bossPoints(2, n))).toEqual([40, 25, 0])
  expect(finalScore(1, 11, 2)).toBe(80)
})

test('hearts: three on floor 1, two on the expert floor', () => {
  expect(RULES[1].hearts).toBe(3)
  expect(RULES[2].hearts).toBe(2)
})
