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
  /**
   * Kept within a narrow range on purpose: the joint solver cannot hold a heavy floor through a much lighter
   * one (a stone roof half hinged to a cardboard half sagged 0.46 rad at 2.4 against 0.25).
   */
  density: number
  friction: number
  restitution: number
  /** Angle (radians) a hinged floor of this material leans at impact. */
  lean: number
}

export const MATERIALS: Record<Material, MaterialSpec> = {
  stone: { widthScale: 1, heightScale: 1, offset: 0, density: 1.2, friction: 0.9, restitution: 0.02, lean: 0 },
  wood: { widthScale: 0.86, heightScale: 0.9, offset: 0.12, density: 1, friction: 0.6, restitution: 0.04, lean: 0.12 },
  cardboard: { widthScale: 0.6, heightScale: 0.7, offset: 0.3, density: 0.8, friction: 0.25, restitution: 0.04, lean: 0.3 },
}

/** Each bonus block (example → pillars, constraint → braces) multiplies the lean of hinged floors by this. */
export const BONUS_LEAN_FACTOR = 0.7
export const CRACK = { gap: 0.06, lean: 0.2 }
/**
 * A hinge is held at its angle by its limits (a soft motor gives way under the load above it): straight until
 * the impact, then turned to its lean over `rampSteps` steps. Each hinge turns by its own lean, zig-zagging
 * from floor to floor, but no hinged floor ends up tilted more than `maxAngle` (radians) in the world.
 */
export const HINGE = { rampSteps: 20, maxAngle: 0.3 }
export const AI_BLOCK = { size: [0.9, 0.6, 0.9] as [number, number, number], density: 1, friction: 0.6, restitution: 0.05, dropHeight: 0.9 }
/** Sideways speed (m/s) given at impact to the bodies of the two highest floors of a vague building. */
export const VAGUE_PUSH = 3
/** For how many steps after the impact the pushed bodies keep that speed (a shove, not a tap). */
export const VAGUE_SHOVE_STEPS = 18
export const TIMELINE = { placeInterval: 12, scanPause: 12, scanSteps: 90, fallSteps: 26, settleSteps: 130 }
export const OUTCOME_LIMITS = { holdTilt: 0.026, collapseTilt: 1.05, collapseDrop: 0.3 }
