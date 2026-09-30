import { CatmullRomCurve3, Vector3 } from 'three'
import type { Pose } from '../layout'

export const WHEEL_SENSITIVITY = 0.0012
export const KEY_STEP = 0.25
export const FLIGHT_SECONDS = 1.2
export const RAIL_SMOOTH_TIME = 0.35

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export interface PoseVectors {
  position: Vector3
  target: Vector3
}

export function makeRail(points: readonly Pose[]) {
  const position = new CatmullRomCurve3(points.map((p) => new Vector3(...p.position)))
  const target = new CatmullRomCurve3(points.map((p) => new Vector3(...p.target)))
  return (t: number, out: PoseVectors = { position: new Vector3(), target: new Vector3() }): PoseVectors => {
    const u = clamp01(t)
    position.getPoint(u, out.position)
    target.getPoint(u, out.target)
    return out
  }
}

const scratch = new Vector3()

export function lerpPose(from: PoseVectors, to: Pose, k: number, out: PoseVectors): PoseVectors {
  out.position.copy(from.position).lerp(scratch.set(...to.position), k)
  out.target.copy(from.target).lerp(scratch.set(...to.target), k)
  return out
}

export function wheelDelta(event: { deltaY: number; deltaMode: number }): number {
  const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 800 : event.deltaY
  return -pixels * WHEEL_SENSITIVITY
}
