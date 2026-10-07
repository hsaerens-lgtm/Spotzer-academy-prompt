import { PerspectiveCamera, Vector3 } from 'three'
import type { Box } from './footprints'
import { CAMERA, GLAZING, ROOM, type Pose, type Vec3 } from './layout'

/*
 * What a camera pose shows: the share of the frame covered by the glazing, and where points and boxes land on screen.
 * The layout tests use it to hold the measured framing of spec criterion 3. Same method as the measurements that chose
 * the rail (plan, Task 5): the camera of Stage.tsx (CAMERA), looking at the pose target, shifted by the pointer
 * parallax when asked; the glazing share is exact, by clipping the projected glass rectangles.
 */

export interface GlazingShare {
  /** Fraction of the frame covered by glazing (side facade and back return). */
  total: number
  /** The part of it on the back return, behind Ada. */
  back: number
}

/** Screen bands kept free by the DOM at 1600 x 900: HUD on top (~70 px), welcome / dialogue panel at the bottom (~200 px). */
export const SCREEN_BANDS = { hudBottom: 0.08, panelTop: 0.77 } as const

/** The office camera at a pose; parallax shifts the target like CameraRig: (+x, -y). */
function poseCamera(pose: Pose, aspect: number, parallax: [number, number] = [0, 0]): PerspectiveCamera {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far)
  camera.position.set(...pose.position)
  camera.lookAt(pose.target[0] + parallax[0], pose.target[1] - parallax[1], pose.target[2])
  camera.updateMatrixWorld()
  return camera
}

const H = ROOM.height
const { side, back } = GLAZING
const SIDE_GLASS: Vec3[] = [
  [side.x, 0, side.z0],
  [side.x, 0, side.z1],
  [side.x, H, side.z1],
  [side.x, H, side.z0],
]
const BACK_GLASS: Vec3[] = [
  [back.x0, 0, back.z],
  [back.x1, 0, back.z],
  [back.x1, H, back.z],
  [back.x0, H, back.z],
]

type Point2 = { x: number; y: number }

/** Keeps the part of a polygon (camera space) in front of the near plane (the camera looks down -z). */
function clipNear(points: Vector3[], near: number): Vector3[] {
  const out: Vector3[] = []
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    const aIn = a.z <= -near
    const bIn = b.z <= -near
    if (aIn) out.push(a)
    if (aIn !== bIn) out.push(a.clone().lerp(b, (-near - a.z) / (b.z - a.z)))
  })
  return out
}

/** Keeps the part of a 2D polygon on one side of a line x = value or y = value. */
function clipEdge(points: Point2[], axis: 'x' | 'y', value: number, keepBelow: boolean): Point2[] {
  const inside = (p: Point2) => (keepBelow ? p[axis] <= value : p[axis] >= value)
  const out: Point2[] = []
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    if (inside(a)) out.push(a)
    if (inside(a) !== inside(b)) {
      const t = (value - a[axis]) / (b[axis] - a[axis])
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  })
  return out
}

function area(points: Point2[]): number {
  let sum = 0
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  })
  return Math.abs(sum) / 2
}

/**
 * Exact fraction of the frame covered by a planar quad: clipped by the near plane, projected, clipped by the frame,
 * then measured. The inner faces of a convex room never hide one another, so this is what the camera sees of them.
 */
function screenShare(camera: PerspectiveCamera, quad: readonly Vec3[]): number {
  const inCamera = clipNear(quad.map((p) => new Vector3(...p).applyMatrix4(camera.matrixWorldInverse)), camera.near)
  if (inCamera.length < 3) return 0
  let polygon: Point2[] = inCamera.map((p) => {
    const ndc = p.clone().applyMatrix4(camera.projectionMatrix)
    return { x: ndc.x, y: ndc.y }
  })
  const edges: [axis: 'x' | 'y', value: number, keepBelow: boolean][] = [
    ['x', 1, true],
    ['x', -1, false],
    ['y', 1, true],
    ['y', -1, false],
  ]
  for (const [axis, value, keepBelow] of edges) {
    polygon = clipEdge(polygon, axis, value, keepBelow)
    if (polygon.length < 3) return 0
  }
  return area(polygon) / 4 // the frame spans 2 x 2 in normalised device coordinates
}

/** Estimate by counting rays: each ray's first hit on the six inner planes of the room (a cross-check of screenShare). */
function countRays(camera: PerspectiveCamera, aspect: number, samples: number): GlazingShare {
  const rows = Math.round(samples / aspect)
  const origin = camera.position
  const direction = new Vector3()
  let sideHits = 0
  let backHits = 0
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < samples; i++) {
      direction.set(((i + 0.5) / samples) * 2 - 1, 1 - ((j + 0.5) / rows) * 2, 0.5).unproject(camera).sub(origin).normalize()
      const tx = direction.x < 0 ? (ROOM.x0 - origin.x) / direction.x : (ROOM.x1 - origin.x) / direction.x
      const ty = direction.y < 0 ? -origin.y / direction.y : (ROOM.height - origin.y) / direction.y
      const tz = direction.z < 0 ? (ROOM.z0 - origin.z) / direction.z : (ROOM.z1 - origin.z) / direction.z
      const t = Math.min(tx, ty, tz)
      if (t === tx && direction.x < 0 && origin.z + t * direction.z <= side.z1) sideHits++
      else if (t === tz && direction.z < 0 && origin.x + t * direction.x <= back.x1) backHits++
    }
  }
  const count = samples * rows
  return { total: (sideHits + backHits) / count, back: backHits / count }
}

/**
 * Share of the frame covered by the glazing, seen from `pose` in a frame of the given aspect (width / height).
 * Exact by default; with `samples`, a count of samples x round(samples / aspect) rays instead.
 * `parallax` shifts the look target by (parallax[0], -parallax[1], 0), as the pointer does in CameraRig.
 */
export function glazingFraction(pose: Pose, aspect: number, options: { samples?: number; parallax?: [number, number] } = {}): GlazingShare {
  const camera = poseCamera(pose, aspect, options.parallax)
  if (options.samples) return countRays(camera, aspect, options.samples)
  const sideShare = screenShare(camera, SIDE_GLASS)
  const backShare = screenShare(camera, BACK_GLASS)
  return { total: sideShare + backShare, back: backShare }
}

/** Where a world point lands in the frame: u, v in 0..1 from the top-left; inFront when it is between the near and far planes. */
export function projectPoint(pose: Pose, aspect: number, point: Vec3, parallax?: [number, number]): { u: number; v: number; inFront: boolean } {
  const ndc = new Vector3(...point).project(poseCamera(pose, aspect, parallax))
  return { u: (ndc.x + 1) / 2, v: (1 - ndc.y) / 2, inFront: ndc.z > -1 && ndc.z < 1 }
}

/** Screen extent of a box: the bounds of its 8 projected corners. */
export function projectBox(pose: Pose, aspect: number, box: Box): { u0: number; u1: number; v0: number; v1: number } {
  const extent = { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity }
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        const { u, v } = projectPoint(pose, aspect, [x, y, z])
        extent.u0 = Math.min(extent.u0, u)
        extent.u1 = Math.max(extent.u1, u)
        extent.v0 = Math.min(extent.v0, v)
        extent.v1 = Math.max(extent.v1, v)
      }
    }
  }
  return extent
}
