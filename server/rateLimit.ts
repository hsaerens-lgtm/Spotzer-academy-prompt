export interface RateLimits {
  perMinute: number
  perDay: number
  globalPerDay: number
}

export type RateDecision = { ok: true } | { ok: false; retryAfter: number }

export interface RateLimiter {
  take(key: string): RateDecision
}

const MINUTE = 60_000
const DAY = 86_400_000

/** In-memory sliding windows per client and overall. Enough for one internal server. */
export function createRateLimiter(limits: RateLimits, now: () => number = Date.now): RateLimiter {
  const perMinute = new Map<string, number[]>()
  const perDay = new Map<string, number[]>()
  let overall: number[] = []
  const recent = (times: number[] | undefined, window: number, at: number) => (times ?? []).filter((time) => at - time < window)
  const wait = (times: number[], window: number, at: number) => Math.max(1, Math.ceil((window - (at - times[0])) / 1000))
  return {
    take(key) {
      const at = now()
      const minute = recent(perMinute.get(key), MINUTE, at)
      const day = recent(perDay.get(key), DAY, at)
      overall = recent(overall, DAY, at)
      if (minute.length >= limits.perMinute) return { ok: false, retryAfter: wait(minute, MINUTE, at) }
      if (day.length >= limits.perDay) return { ok: false, retryAfter: wait(day, DAY, at) }
      if (overall.length >= limits.globalPerDay) return { ok: false, retryAfter: wait(overall, DAY, at) }
      minute.push(at)
      day.push(at)
      overall.push(at)
      perMinute.set(key, minute)
      perDay.set(key, day)
      return { ok: true }
    },
  }
}
