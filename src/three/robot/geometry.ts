import { Vector2 } from 'three'

/** Ada's proportions, in metres. The group origin is the bottom tip of the body. */
export const ADA = {
  bodyHeight: 0.62,
  bodyRadius: 0.24,
  headRadius: 0.18,
  headGap: 0.07,
  armLength: 0.36,
  armX: 0.27,
  armY: 0.5,
  beltY: 0.47,
  chestY: 0.36,
} as const

export const HEAD_Y = ADA.bodyHeight + ADA.headGap + ADA.headRadius * 0.85

/** Front part of the head sphere covered by the black visor (front = +z, i.e. phi = PI/2). */
export const VISOR = { phiStart: Math.PI / 2 - 0.95, phiLength: 1.9, thetaStart: 0.62, thetaLength: 1.2 } as const

/** Egg profile: pointed at the bottom, widest around 68 % of the height, rounded on top. */
export function bodyRadiusAt(y: number): number {
  const s = Math.min(1, Math.max(0, y / ADA.bodyHeight))
  return ADA.bodyRadius * Math.pow(Math.sin(Math.PI * Math.pow(s, 1.8)), 0.6)
}

export function bodyProfile(segments = 32): Vector2[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const y = (i / segments) * ADA.bodyHeight
    return new Vector2(Math.max(0, bodyRadiusAt(y)), y)
  })
}
