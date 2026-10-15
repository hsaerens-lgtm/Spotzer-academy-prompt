import type { RunEffect } from '../../dungeon/run'

/** Spec 3, §3.8: synthesized notes only, in Hz (no audio files). */
export const JINGLES: Record<RunEffect, readonly number[]> = {
  step: [180],
  bump: [90],
  encounter: [392, 523],
  correct: [523, 659, 784],
  wrong: [392, 311, 247],
  boss: [220, 208, 196],
  bossHit: [147, 110],
  victory: [523, 659, 784, 1047],
  ejected: [330, 262, 196, 131],
}
