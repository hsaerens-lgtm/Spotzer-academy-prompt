import type { Via } from '../../core/store'

export type Vec3 = [number, number, number]

export interface Pose {
  position: Vec3
  target: Vec3
}

export interface Placement {
  position: Vec3
  rotationY?: number
}

/**
 * Single source of truth for the office: camera rail, flights and (Task 16) furniture.
 * Units are metres. The room spans x -5..5, z -6..6; the screen wall is at z = -6.
 * The object is mutable on purpose: the tuning panel (?tune) edits it live.
 */
export const layout = {
  rail: [
    { position: [1.6, 2.4, 5.7], target: [0.4, 1.1, -3.0] },
    { position: [0.2, 1.85, 2.3], target: [-0.9, 1.45, -4.6] },
    { position: [-1.5, 1.35, -1.4], target: [-1.5, 1.6, -5.97] },
  ] as Pose[],
  flights: {
    laptop: { position: [-0.8, 0.95, 0.39], target: [-0.8, 0.87, 0.1] },
    tv: { position: [3.95, 0.8, -1.4], target: [4.35, 0.78, -1.4] },
  } as Record<Via, Pose>,
}

/** Bumped by the tuning panel so the camera rig rebuilds its curves. */
export const layoutVersion = { current: 0 }

export function bumpLayout() {
  layoutVersion.current += 1
}
