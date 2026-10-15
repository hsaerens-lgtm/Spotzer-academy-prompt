import type { Floor } from './model'

interface FloorRules {
  hearts: number
  perGuardian: number
  /** Points for beating the boss on the 1st, 2nd, 3rd attempt. */
  boss: readonly number[]
  /** Explanations after each answer (floor 1) or only on the review screen (floor 2). */
  corrections: 'immediate' | 'end'
}

/** Spec 3, §4.3. */
export const RULES: Record<Floor, FloorRules> = {
  1: { hearts: 3, perGuardian: 5, boss: [35, 25, 15], corrections: 'immediate' },
  2: { hearts: 2, perGuardian: 4, boss: [40, 25], corrections: 'end' },
}

export function bossPoints(floor: Floor, attempt: number): number {
  return RULES[floor].boss[attempt - 1] ?? 0
}

export function finalScore(floor: Floor, guardiansRight: number, bossAttempts: number): number {
  return guardiansRight * RULES[floor].perGuardian + bossPoints(floor, bossAttempts)
}
