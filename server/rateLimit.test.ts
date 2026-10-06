// @vitest-environment node
import { createRateLimiter } from './rateLimit.ts'

test('each client gets the per-minute limit, then is asked to wait', () => {
  let time = 0
  const limiter = createRateLimiter({ perMinute: 2, perDay: 10, globalPerDay: 100 }, () => time)
  expect(limiter.take('a')).toEqual({ ok: true })
  expect(limiter.take('a')).toEqual({ ok: true })
  expect(limiter.take('a')).toEqual({ ok: false, retryAfter: 60 })
  expect(limiter.take('b')).toEqual({ ok: true })
  time = 60_001
  expect(limiter.take('a')).toEqual({ ok: true })
})

test('a daily limit per client and a global daily cap', () => {
  const limiter = createRateLimiter({ perMinute: 100, perDay: 2, globalPerDay: 3 }, () => 0)
  limiter.take('a')
  limiter.take('a')
  expect(limiter.take('a')).toMatchObject({ ok: false })
  expect(limiter.take('b')).toEqual({ ok: true })
  expect(limiter.take('c')).toEqual({ ok: false, retryAfter: 86400 })
})
