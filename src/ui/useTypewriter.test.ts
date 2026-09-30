import { CHARS_PER_SECOND, revealedCount } from './useTypewriter'

test('reveals characters at a steady pace and never overshoots', () => {
  expect(revealedCount(0, 100)).toBe(0)
  expect(revealedCount(1000, 100)).toBe(CHARS_PER_SECOND)
  expect(revealedCount(60_000, 100)).toBe(100)
  expect(revealedCount(500, 10, 10)).toBe(5)
})
