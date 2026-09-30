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

export const TABLE = { center: { x: -1.0, z: -1.8 }, radii: { x: 1.25, z: 2.5 }, topY: 0.75 }

/** Four chairs on each long side of the oval table, turned toward it. */
export function chairRing(): Placement[] {
  return [-3.6, -2.4, -1.2, 0.0].flatMap((z) => {
    const dz = (z - TABLE.center.z) / TABLE.radii.z
    const offset = TABLE.radii.x * Math.sqrt(1 - dz * dz) + 0.5
    return [
      { position: [TABLE.center.x - offset, 0, z] as Vec3, rotationY: Math.PI / 2 },
      { position: [TABLE.center.x + offset, 0, z] as Vec3, rotationY: -Math.PI / 2 },
    ]
  })
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
  objects: {
    table: { position: [TABLE.center.x, 0, TABLE.center.z] } as Placement,
    chairs: chairRing(),
    microphones: [-3.0, -1.8, -0.6].flatMap((z) => [
      { position: [TABLE.center.x - 0.72, TABLE.topY, z] as Vec3, rotationY: -Math.PI / 2 },
      { position: [TABLE.center.x + 0.72, TABLE.topY, z] as Vec3, rotationY: Math.PI / 2 },
    ]) as Placement[],
    sideboard: { position: [-1.0, 0, -5.72] } as Placement,
    lamp: { position: [1.0, 0.7, -5.72] } as Placement,
    laptop: { position: [-0.8, TABLE.topY, 0.25], rotationY: 0 } as Placement,
    cabinet: { position: [4.62, 0, -1.4], rotationY: -Math.PI / 2 } as Placement,
    tv: { position: [4.6, 0.5, -1.4], rotationY: -Math.PI / 2 } as Placement,
    retroConsole: { position: [4.5, 0.5, -0.9], rotationY: -Math.PI / 2 } as Placement,
    sofa: { position: [2.9, 0, -1.4], rotationY: Math.PI / 2 } as Placement,
    logo: { position: [4.93, 1.9, -4.2], rotationY: -Math.PI / 2 } as Placement,
  },
  screen: { position: [-1.0, 1.9, -5.93] as Vec3, size: [4.0, 2.25] as [number, number] },
  ada: { position: [-3.4, 0.95, -4.7], rotationY: 0.5 } as Placement,
  lights: {
    hemisphere: { sky: '#FFE6C7', ground: '#1A1512', intensity: 0.5 },
    key: { position: [3, 6, 4] as Vec3, intensity: 1.2, color: '#FFE2BF' },
    fills: [
      { position: [-1.0, 2.95, -2.0] as Vec3, intensity: 8, distance: 9, color: '#FFC98A' },
      { position: [3.6, 2.9, -1.4] as Vec3, intensity: 5, distance: 7, color: '#FFC98A' },
    ],
    screenGlow: { position: [-1.0, 1.9, -5.3] as Vec3, intensity: 1.2, color: '#9FB8C8' },
  },
}

/** Bumped by the tuning panel so the camera rig rebuilds its curves. */
export const layoutVersion = { current: 0 }

export function bumpLayout() {
  layoutVersion.current += 1
}
