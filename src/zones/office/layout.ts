import type { Via } from '../../core/store'
import type { HangingPlacement, PlantPlacement, ShelfBooksSpec, VasePlacement } from '../../three/plants/types'

export type Vec3 = [number, number, number]

export interface Pose {
  position: Vec3
  target: Vec3
}

export interface Placement {
  position: Vec3
  rotationY?: number
}

/** The meeting room: 10 x 12 m, 3.2 m under the ceiling. The screen wall is z = -6, the glazing x = -5. */
export const ROOM = { width: 10, depth: 12, height: 3.2, x0: -5, x1: 5, z0: -6, z1: 6 } as const
/**
 * Wall thickness: the walls are 20 cm, the floor and ceiling slabs 10 cm (room/plan.ts). They cast shadows and the
 * walls show their thickness at the edge of the glazing.
 */
export const WALL_T = 0.2
/** The office camera. `far` holds the 600 m sky dome and the city inside it (outdoor/cityPlan.ts). */
export const CAMERA = { fov: 45, near: 0.1, far: 1000 } as const
/** Floor-to-ceiling glazing: the left facade, and its return on the back wall behind Ada. */
export const GLAZING = {
  side: { x: -5, z0: -6, z1: 4.4 }, // left facade, floor to ceiling
  back: { z: -6, x0: -5, x1: -3.4 }, // return on the back wall, behind Ada
  sideMullionsZ: [-4.8, -3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6],
  backMullionsX: [-4.2],
  mullion: { width: 0.05, depth: 0.08 },
  transomY: 0.45,
  glassInset: 0.02, // glass planes at x = -5.02 and z = -6.02
} as const
/** Low bench along the glazing, with plants on it. */
export const BANQUETTE = { x0: -4.98, x1: -4.53, z0: -4.9, z1: 1.2, height: 0.42 } as const
/** Vertical oak slats behind the wall screen: z from -6 to -5.97, floor to ceiling. */
export const SLAT_WALL = { x0: -3.32, x1: 1.36, depth: 0.03, slat: 0.045, gap: 0.015 } as const
export const RUG = { center: [-1.0, -1.8] as const, size: [4.2, 6.8] as const, thickness: 0.012 } as const
/** Height of the contact shadows: above the 12 mm rug, so no flat surface shares their height. */
export const CONTACT_SHADOW_Y = 0.02
/** Two recessed light lines in the ceiling, along z. */
export const CEILING_LINES = [
  { x: -2.6, z0: -5.0, z1: 2.2 },
  { x: 0.6, z0: -5.0, z1: 2.2 },
] as const
export const SKIRTING = { height: 0.08, depth: 0.015 } as const
/** Wall shelves of the lounge corner: board bottoms at 1.3 and 1.75 m (tops at 1.325 and 1.775). */
export const SHELVES = { width: 1.4, depth: 0.24, thickness: 0.025, boards: [1.3, 1.75] } as const

export const TABLE = { center: { x: -1.0, z: -1.8 }, radii: { x: 1.25, z: 2.5 }, topY: 0.75, topThickness: 0.04, edgeRadius: 0.015 }

/** Racetrack top: straight sides for |dz| <= radii.z - radii.x, semicircular ends of radius radii.x, 0 beyond the ends. */
export function tableHalfWidthAt(z: number): number {
  const { radii } = TABLE
  const straight = radii.z - radii.x
  const dz = Math.abs(z - TABLE.center.z)
  if (dz <= straight) return radii.x
  const d = dz - straight
  return d >= radii.x ? 0 : Math.sqrt(radii.x * radii.x - d * d)
}

/** Four chairs on each long side, 0.5 m out from the racetrack edge, turned toward it. */
export function chairRing(): Placement[] {
  return [-3.6, -2.4, -1.2, 0.0].flatMap((z) => {
    const offset = tableHalfWidthAt(z) + 0.5
    return [
      { position: [TABLE.center.x - offset, 0, z] as Vec3, rotationY: Math.PI / 2 },
      { position: [TABLE.center.x + offset, 0, z] as Vec3, rotationY: -Math.PI / 2 },
    ]
  })
}

/**
 * Single source of truth for the office: camera rail, flights, furniture and decor.
 * Units are metres. The room spans x -5..5, z -6..6; the screen wall is at z = -6.
 * The object is mutable on purpose: the tuning panel (?tune) edits it live.
 * Keep its top-level keys (tune.ts layoutSnapshot): new constants are separate exports above.
 */
export const layout = {
  rail: [
    // overview: retro corner and laptop in frame, glazing 13.9 % of a 16:9 frame
    { position: [2.0, 2.5, 5.8], target: [0.4, 0.95, -1.3] },
    // intermediate: turns toward the facade, glazing 25.7 % (the city opens up)
    { position: [0.2, 1.8, 2.3], target: [-2.4, 1.4, -4.6] },
    // presentation, unchanged
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
    sideboard: { position: [-0.9, 0, -5.62] } as Placement, // two model units at local x = +/-1.22
    lamp: { position: [1.3, 0.68, -5.62] } as Placement,
    laptop: { position: [-0.8, TABLE.topY, 0.25], rotationY: 0 } as Placement,
    tvStand: { position: [4.62, 0, -1.4], rotationY: -Math.PI / 2 } as Placement,
    tv: { position: [4.6, 0.5, -1.4], rotationY: -Math.PI / 2 } as Placement,
    retroConsole: { position: [4.5, 0.5, -0.9], rotationY: -Math.PI / 2 } as Placement,
    sofa: { position: [2.9, 0, -1.4], rotationY: Math.PI / 2 } as Placement,
    floorLamp: { position: [2.9, 0, -2.8] } as Placement, // beside the sofa's end on the back-wall side
    logo: { position: [2.6, 1.95, -5.995], rotationY: 0 } as Placement, // back of the sign's plate, 5 mm off the wall
    clock: { position: [1.75, 2.19, -5.975], rotationY: 0 } as Placement, // bottom of the normalised clock; dial centre at y 2.35
    cabinet: { position: [4.74, 0, -4.2], rotationY: -Math.PI / 2 } as Placement, // drawer_cabinet (decor)
    coffeeTable: { position: [3.85, 0, -1.4], rotationY: 0 } as Placement,
    shelves: { position: [3.95, 0, -5.87], rotationY: 0 } as Placement,
    pendants: [-3.0, -1.8, -0.6].map((z) => ({ position: [-1.0, 2.248, z] as Vec3 })) as Placement[], // bottom of the globe; top touches the ceiling
    frames: [
      { position: [4.99, 1.24, -3.1], rotationY: -Math.PI / 2 },
      { position: [4.99, 1.24, 0.3], rotationY: -Math.PI / 2 },
    ] as Placement[],
    plants: [
      // the first five stand on the banquette: their leaves stay clear of the facade frame (decor.test.ts, Task 14)
      { kind: 'succulent', position: [-4.755, 0.42, -4.3], pot: 'cream', r: 0.07, h: 0.08, scale: 1, seed: 5, sway: 0 },
      { kind: 'monstera', position: [-4.705, 0.42, -3.0], pot: 'cream', r: 0.16, h: 0.22, scale: 0.7, seed: 11, sway: 0.006 },
      { kind: 'fern', position: [-4.67, 0.42, -1.2], pot: 'slate', r: 0.13, h: 0.16, scale: 0.95, seed: 23, sway: 0.008 },
      { kind: 'succulent', position: [-4.755, 0.42, -0.4], pot: 'terracotta', r: 0.06, h: 0.07, scale: 1, seed: 9, sway: 0 },
      { kind: 'pothos', position: [-4.755, 0.42, 0.5], pot: 'terracotta', r: 0.1, h: 0.12, scale: 1, seed: 31, sway: 0.01, fall: Math.PI / 2 },
      // the palm left its old place, where it hid part of the retro corner from the overview
      { kind: 'palm', position: [4.45, 0, -2.9], pot: 'slate', r: 0.2, h: 0.32, scale: 0.9, seed: 41, sway: 0.006 },
      { kind: 'herb', position: [3.45, 1.775, -5.87], pot: 'terracotta', r: 0.06, h: 0.08, scale: 1, seed: 47, sway: 0 },
      { kind: 'pothos', position: [4.5, 1.775, -5.87], pot: 'cream', r: 0.07, h: 0.09, scale: 0.8, seed: 53, sway: 0.008, fall: 0 },
    ] as PlantPlacement[],
    hangingPlants: [
      { position: [-4.25, 3.2, -3.8], seed: 3, glaze: 'white', vines: 11, length: 0.9, drop: 0.55 },
      { position: [-4.25, 3.2, -0.2], seed: 7, glaze: 'sage', vines: 9, length: 0.8, drop: 0.5 },
    ] as HangingPlacement[],
    largePlants: {
      pottedPlant: { position: [-4.4, 0, 1.75], rotationY: 0.6 } as Placement,
      pachira: { position: [-4.45, 0, -5.45], rotationY: 0 } as Placement, // in the clay pot scaled x 1.6, tree 1.55 m tall standing at y 0.325
    },
    vases: [
      { model: 'vaseTall', position: [-3.2, 0.68, -5.62], plant: { kind: 'pothos', r: 0.08, h: 0.1, scale: 0.8, seed: 71, sway: 0.008, fall: 0 } },
      { model: 'vaseRound', position: [-4.74, 0.42, -2.1], plant: { kind: 'fern', r: 0.08, h: 0.1, scale: 0.6, seed: 73, sway: 0.008 } },
    ] as VasePlacement[],
    shelfBooks: [
      { x0: 3.3, x1: 4.6, y: 1.325, z: -5.87, seed: 61 },
      { x0: 3.75, x1: 4.3, y: 1.775, z: -5.87, seed: 67 },
    ] as ShelfBooksSpec[],
  },
  screen: { position: [-1.0, 1.9, -5.93] as Vec3, size: [4.0, 2.25] as [number, number] },
  ada: { position: [-3.15, 1.1, -4.85], rotationY: 0.5 } as Placement,
  lights: {
    screenGlow: { position: [-1.0, 1.9, -5.3] as Vec3 },
    pendant: { position: [-1.0, 2.1, -1.8] as Vec3 },
    lamp: { position: [1.3, 1.12, -5.5] as Vec3, target: [1.3, 0.68, -4.9] as Vec3 },
    crt: { position: [4.25, 0.75, -1.4] as Vec3, target: [2.9, 0.45, -1.4] as Vec3 }, // before the TV picture, aimed at the sofa
    floorLamp: { position: [2.9, 1.4, -2.8] as Vec3 }, // the centre of the floor lamp's shade
  },
}

/** Bumped by the tuning panel so the camera rig rebuilds its curves. */
export const layoutVersion = { current: 0 }

export function bumpLayout() {
  layoutVersion.current += 1
}
