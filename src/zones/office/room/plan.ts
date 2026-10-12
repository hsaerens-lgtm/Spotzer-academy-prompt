import type { MaterialKey } from '../../../three/materials'
import {
  BANQUETTE,
  CEILING_LINES,
  CONTACT_SHADOW_Y,
  GLAZING,
  ROOM,
  RUG,
  SKIRTING,
  SLAT_WALL,
  WALL_T,
  type Vec3,
} from '../layout'

/*
 * The room as boxes: floor and ceiling slabs (10 cm), walls (20 cm), skirting, glazing frame, slats, banquette,
 * ceiling lines and rug. Pure data (Room.tsx and Glazing.tsx turn it into meshes), so the tests can check that walls
 * close the room, that the glazing stays open and that no two visible surfaces share a plane (Horn.os rule: no
 * coplanar surfaces).
 */

export interface BoxSpec {
  name: string
  center: Vec3
  size: Vec3
  material: MaterialKey
  castShadow: boolean
  receiveShadow: boolean
}

/** A glass pane: a plane of `size` [width, height], turned by rotationY (its width runs along x before turning). */
export interface PaneSpec {
  name: string
  center: Vec3
  size: [number, number]
  rotationY: number
}

const H = ROOM.height
const MID = H / 2

const box = (name: string, center: Vec3, size: Vec3, material: MaterialKey, castShadow = true, receiveShadow = true): BoxSpec => ({
  name,
  center,
  size,
  material,
  castShadow,
  receiveShadow,
})

/**
 * The 10 cm floor and ceiling slabs, the four 20 cm walls (open where the glazing is) and the skirting. The skirting
 * runs are trimmed where they meet, so no two of them share a top face at a corner.
 */
export function shellBoxes(): BoxSpec[] {
  const t = WALL_T
  const outerW = ROOM.width + 2 * t
  const outerD = ROOM.depth + 2 * t
  const backX0 = GLAZING.back.x1 // the back wall starts where the glass return ends
  const leftZ0 = GLAZING.side.z1 // the left wall starts where the facade glazing ends
  const k = SKIRTING.height
  const s = SKIRTING.depth
  return [
    box('floor', [0, -t / 4, 0], [outerW, t / 2, outerD], 'floor', false, true),
    box('ceiling', [0, H + t / 4, 0], [outerW, t / 2, outerD], 'ceiling'),
    box('wall-back', [(backX0 + ROOM.x1 + t) / 2, MID, ROOM.z0 - t / 2], [ROOM.x1 + t - backX0, H, t], 'wall'),
    box('wall-right', [ROOM.x1 + t / 2, MID, 0], [t, H, outerD], 'wall'),
    box('wall-front', [0, MID, ROOM.z1 + t / 2], [outerW, H, t], 'wall'),
    box('wall-left', [ROOM.x0 - t / 2, MID, (leftZ0 + ROOM.z1 + t) / 2], [t, H, ROOM.z1 + t - leftZ0], 'wall'),
    box('skirting-back', [(backX0 + ROOM.x1) / 2, k / 2, ROOM.z0 + s / 2], [ROOM.x1 - backX0, k, s], 'skirting', false, true),
    // Each corner belongs to one run: the back run takes its corner with the right run, the front run takes its corner
    // with the right run, and the left run takes its corner with the front run. The right run therefore stops short of
    // the back and front runs, and the front run starts after the left one.
    box('skirting-right', [ROOM.x1 - s / 2, k / 2, 0], [s, k, ROOM.depth - 2 * s], 'skirting', false, true),
    box('skirting-front', [s / 2, k / 2, ROOM.z1 - s / 2], [ROOM.width - s, k, s], 'skirting', false, true),
    box('skirting-left', [ROOM.x0 + s / 2, k / 2, (leftZ0 + ROOM.z1) / 2], [s, k, ROOM.z1 - leftZ0], 'skirting', false, true),
  ]
}

/** The transoms sit this far inside the faces of the posts, so none of their faces shares a plane with a post's. */
const TRANSOM_RECESS = 0.005

/**
 * Black aluminium frame of the glazing: corner post, mullions, end posts and the low transoms. The transoms are 5 mm
 * shallower than the posts on each side and end 5 mm inside the corner post and the end posts: they run between them
 * without touching each other and without a face flush with a post face (Horn.os rule: no coplanar surfaces).
 */
export function glazingFrameBoxes(): BoxSpec[] {
  const { side, back, mullion, transomY } = GLAZING
  const w = mullion.width
  const d = mullion.depth
  const td = d - 2 * TRANSOM_RECESS
  const sideZ0 = back.z + d / 2 - TRANSOM_RECESS // inside the corner post
  const sideZ1 = side.z1 - w + TRANSOM_RECESS // inside the end post of the facade
  const backX0 = side.x + d / 2 - TRANSOM_RECESS // inside the corner post
  const backX1 = back.x1 - w + TRANSOM_RECESS // inside the end post of the return
  const metal = (name: string, center: Vec3, size: Vec3) => box(name, center, size, 'blackMetal')
  return [
    metal('post-corner', [side.x, MID, back.z], [d, H, d]),
    ...GLAZING.sideMullionsZ.map((z, i) => metal(`post-side-${i}`, [side.x, MID, z], [d, H, w])),
    metal('post-side-end', [side.x, MID, side.z1 - w / 2], [d, H, w]),
    ...GLAZING.backMullionsX.map((x, i) => metal(`post-back-${i}`, [x, MID, back.z], [w, H, d])),
    metal('post-back-end', [back.x1 - w / 2, MID, back.z], [w, H, d]),
    metal('transom-side', [side.x, transomY, (sideZ0 + sideZ1) / 2], [td, w, sideZ1 - sideZ0]),
    metal('transom-back', [(backX0 + backX1) / 2, transomY, back.z], [backX1 - backX0, w, td]),
  ]
}

/** The two glass planes, 2 cm outside the inner face of the room. */
export function glassPanes(): PaneSpec[] {
  const { side, back, glassInset } = GLAZING
  return [
    { name: 'glass-side', center: [side.x - glassInset, MID, (side.z0 + side.z1) / 2], size: [side.z1 - side.z0, H], rotationY: Math.PI / 2 },
    { name: 'glass-back', center: [(back.x0 + back.x1) / 2, MID, back.z - glassInset], size: [back.x1 - back.x0, H], rotationY: 0 },
  ]
}

/** Vertical oak slats behind the wall screen, floor to ceiling (Room.tsx merges them into one mesh). */
export function slatBoxes(): BoxSpec[] {
  const { x0, x1, depth, slat, gap } = SLAT_WALL
  const slats: BoxSpec[] = []
  for (let i = 0; ; i++) {
    const x = x0 + i * (slat + gap)
    if (x + slat > x1 + 1e-9) break
    slats.push(box(`slat-${i}`, [x + slat / 2, MID, ROOM.z0 + depth / 2], [slat, H, depth], 'slats'))
  }
  return slats
}

/** Oak bench top on a black steel base, along the glazing. */
export function banquetteBoxes(): BoxSpec[] {
  const { x0, x1, z0, z1, height } = BANQUETTE
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const top = 0.04
  return [
    box('banquette-top', [cx, height - top / 2, cz], [x1 - x0, top, z1 - z0], 'oak'),
    box('banquette-base', [cx, (height - top) / 2, cz], [x1 - x0 - 0.06, height - top, z1 - z0 - 0.06], 'paintedSteel'),
  ]
}

/** Each ceiling line: a black channel against the ceiling and the emissive strip just below it. No shadows. */
export function ceilingLineBoxes(): BoxSpec[] {
  return CEILING_LINES.flatMap((line, i) => {
    const length = line.z1 - line.z0
    const z = (line.z0 + line.z1) / 2
    return [
      box(`ceiling-channel-${i}`, [line.x, H - 0.005, z], [0.1, 0.01, length], 'blackMetal', false, false),
      box(`ceiling-strip-${i}`, [line.x, H - 0.012, z], [0.06, 0.004, length], 'ceilingStrip', false, false),
    ]
  })
}

export function rugBox(): BoxSpec {
  return box('rug', [RUG.center[0], RUG.thickness / 2, RUG.center[1]], [RUG.size[0], RUG.thickness, RUG.size[1]], 'rug', false, true)
}

/** Every height where something is laid flat on the floor: all distinct, so nothing flickers in the depth test. */
export const FLAT_LEVELS: readonly { name: string; y: number }[] = [
  { name: 'floor', y: 0 },
  { name: 'rug', y: RUG.thickness },
  { name: 'contact shadows', y: CONTACT_SHADOW_Y },
]
