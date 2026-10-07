import { CatmullRomCurve3, Vector3 } from 'three'
import type { Pose } from '../layout'

export const WHEEL_SENSITIVITY = 0.0012
export const KEY_STEP = 0.25
export const FLIGHT_SECONDS = 1.2
export const RAIL_SMOOTH_TIME = 0.35
/** Pointer parallax: the look target moves up to x sideways and y up or down (CameraRig; the framing tests use the extremes). */
export const PARALLAX = { x: 0.35, y: 0.18 }

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

export type RailKeyAction = { kind: 'nudge'; delta: number } | { kind: 'set'; t: number }

/**
 * What a keydown does to the rail, or null when the key must be left alone
 * (other zone, transition, expanded view, editable target, modifier combos).
 */
export function railKeyAction(
  event: { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean },
  state: { zone: string; transition: unknown; expandOpen: boolean },
  editable: boolean,
): RailKeyAction | null {
  if (state.zone !== 'office' || state.transition || state.expandOpen || editable) return null
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  switch (event.key) {
    case 'ArrowUp':
      return { kind: 'nudge', delta: KEY_STEP }
    case 'ArrowDown':
      return { kind: 'nudge', delta: -KEY_STEP }
    case 'Home':
      return { kind: 'set', t: 0 }
    case 'End':
      return { kind: 'set', t: 1 }
    default:
      return null
  }
}
