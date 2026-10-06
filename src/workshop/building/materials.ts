import type { CoreBlock } from '../model'

/** Fixed simulation rate: every event is scheduled by step number, never by wall-clock time. */
export const STEP_HZ = 60
/** Rapier's default (4) lets a light floor jitter under heavier floors welded to it. */
export const SOLVER_ITERATIONS = 8
export const DEPTH = 1.6

export const FLOORS: Record<CoreBlock, { width: number; height: number }> = {
  role: { width: 2.8, height: 0.36 },
  task: { width: 2.4, height: 0.5 },
  context: { width: 2.4, height: 0.5 },
  format: { width: 2.6, height: 0.32 },
}

export type Material = 'stone' | 'wood' | 'cardboard'

export interface MaterialSpec {
  widthScale: number
  heightScale: number
  /** Sideways offset from the axis (zig-zag from floor to floor). */
  offset: number
  density: number
  friction: number
  restitution: number
  /** Angle (radians) a hinged floor of this material leans at impact. */
  lean: number
}

export const MATERIALS: Record<Material, MaterialSpec> = {
  stone: { widthScale: 1, heightScale: 1, offset: 0, density: 2.4, friction: 0.9, restitution: 0.02, lean: 0 },
  wood: { widthScale: 0.86, heightScale: 0.9, offset: 0.12, density: 0.8, friction: 0.6, restitution: 0.04, lean: 0.12 },
  cardboard: { widthScale: 0.6, heightScale: 0.7, offset: 0.3, density: 0.25, friction: 0.25, restitution: 0.04, lean: 0.3 },
}

/** Each bonus block (example → pillars, constraint → braces) multiplies the lean of hinged floors by this. */
export const BONUS_LEAN_FACTOR = 0.7
export const CRACK = { gap: 0.06, lean: 0.2 }
/**
 * Hinge motor: stiff enough to lean a floor under the whole load above it, its target ramped from 0 to the
 * lean over `rampSteps` after the impact.
 */
export const HINGE = { stiffness: 100_000, damping: 600, margin: 0.06, rampSteps: 20 }
export const AI_BLOCK = { size: [0.9, 0.6, 0.9] as [number, number, number], density: 1, friction: 0.6, restitution: 0.05, dropHeight: 0.9 }
/** Sideways speed (m/s) given at impact to the two highest bodies of a vague building. */
export const VAGUE_PUSH = 3
/** For how many steps after the impact the pushed bodies keep that speed (a shove, not a tap). */
export const VAGUE_SHOVE_STEPS = 18
export const TIMELINE = { placeInterval: 12, scanPause: 12, scanSteps: 90, fallSteps: 26, settleSteps: 130 }
export const OUTCOME_LIMITS = { holdTilt: 0.026, collapseTilt: 1.05, collapseDrop: 0.3 }
