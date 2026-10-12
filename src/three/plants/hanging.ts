// Ported from Horn.os (owner's project): js/scene/hanging.js (planter profile from js/scene/models.js)
import {
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  LatheGeometry,
  Matrix4,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three'
import { at, mergeParts, type Part } from '../merge'
import { between } from '../shapes'
import { tints } from '../tints'
import type { HangingPlacement } from './types'

/*
 * A golden pothos in a macrame hanger: a glazed pot, a crown of leaves, and vines falling from the rim with a
 * heart-shaped leaf every few centimetres, smaller toward the tip. Geometry only, in three merged pieces (cords,
 * pot, canopy), origin at the ceiling hook, everything below it. Horn.os' vines are narrowed here to fit the
 * 0.5 m footprint of a hanging plant (zones/office/footprints.ts): they fall straight down from the rim.
 */

export interface HangingGeometry {
  /** Four cords from under the pot to the hook, their knots and the tassel. */
  cords: BufferGeometry
  /** The turned planter (lathe profile with a rolled rim), UVs around it. */
  pot: BufferGeometry
  /** Vines, crown leaves and the soil disc, with a 'color' attribute and UVs. */
  canopy: BufferGeometry
}
export type HangingOptions = Omit<HangingPlacement, 'position'>
export interface Vine {
  /** Control points of the vine, from the soil down. */
  points: Vector3[]
  /** Horizontal direction the vine leaves the pot in. */
  out: Vector3
}

/** Pot of every hanging planter, in metres (Horn.os defaults). */
export const HANGING_POT = { r: 0.09, h: 0.11 } as const
/** Vine control points stay within this distance of the hook axis; the leaves add about 3 cm. */
export const VINE_REACH = 0.19

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Height of the pot's bottom and of its soil, below the hook. */
function potLevels(drop: number): { potY: number; soilY: number } {
  const potY = -drop - HANGING_POT.h
  return { potY, soilY: potY + HANGING_POT.h * 0.88 }
}

/**
 * The vines of a hanging plant: `vines` of them, spread round the rim, each falling `length` x 0.45 to 0.95 below
 * the soil. Their own LCG stream: the same options give the same vines.
 */
export function hangingVines(options: Pick<HangingOptions, 'seed' | 'vines' | 'length' | 'drop'>): Vine[] {
  const { seed, vines, length, drop } = options
  const rand = seeded(seed)
  const { soilY } = potLevels(drop)
  const result: Vine[] = []
  for (let v = 0; v < vines; v++) {
    const a = (v / vines) * Math.PI * 2 + rand() * 0.5
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const fall = length * (0.45 + rand() * 0.5)
    const start = new Vector3(out.x * HANGING_POT.r * 0.8, soilY + 0.01, out.z * HANGING_POT.r * 0.8)
    const points = [start, start.clone().addScaledVector(out, 0.05).add(new Vector3(0, 0.03, 0))]
    let p = points[1].clone()
    const steps = 6
    for (let k = 1; k <= steps; k++) {
      p = p.clone().addScaledVector(out, 0.02 * (1 - k / steps) + 0.004).add(new Vector3((rand() - 0.5) * 0.03, -fall / steps, (rand() - 0.5) * 0.03))
      const radial = Math.hypot(p.x, p.z)
      if (radial > VINE_REACH) p.set((p.x * VINE_REACH) / radial, p.y, (p.z * VINE_REACH) / radial)
      points.push(p)
    }
    result.push({ points, out })
  }
  return result
}

/** One leaf: a cupped heart, tip up (+y, 1 unit long before scaling), attached at the notch (origin). */
let leafShape: BufferGeometry | null = null
function hangingLeaf(): BufferGeometry {
  if (leafShape) return leafShape
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.22, -0.1, 0.6, 0.18, 0.42, 0.58)
  shape.bezierCurveTo(0.32, 0.8, 0.1, 0.92, 0, 1.0)
  shape.bezierCurveTo(-0.1, 0.92, -0.32, 0.8, -0.42, 0.58)
  shape.bezierCurveTo(-0.6, 0.18, -0.22, -0.1, 0, 0)
  const geometry = new ShapeGeometry(shape, 10)
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    uv.setXY(i, x + 0.5, y)
    // Cupped across the width, the tip curling back a little.
    position.setZ(i, -0.35 * x * x + 0.18 * y * y)
  }
  geometry.computeVertexNormals()
  leafShape = geometry
  return geometry
}

/** Horn.os planter: a lathe profile with a rolled rim, standing on y = 0. */
function planterGeometry(r: number, h: number): BufferGeometry {
  const profile = [
    new Vector2(0, 0),
    new Vector2(r * 0.7, 0),
    new Vector2(r * 0.76, h * 0.03),
    new Vector2(r * 0.92, h * 0.45),
    new Vector2(r, h * 0.92),
    new Vector2(r * 1.04, h * 0.97),
    new Vector2(r * 1.02, h),
    new Vector2(r * 0.93, h),
    new Vector2(r * 0.9, h * 0.9),
  ]
  return new LatheGeometry(profile, 48)
}

const cache = new Map<string, HangingGeometry>()

/** A hanging plant below its hook (origin). The same options give the same plant; cached by its options. */
export function hangingGeometry(options: HangingOptions): HangingGeometry {
  const { seed, glaze, vines, length, drop } = options
  const key = JSON.stringify([seed, glaze, vines, length, drop])
  const cached = cache.get(key)
  if (cached) return cached
  const built = buildHanging({ seed, glaze, vines, length, drop })
  cache.set(key, built)
  return built
}

function buildHanging(options: HangingOptions): HangingGeometry {
  const { seed, drop } = options
  const { r: potR, h: potH } = HANGING_POT
  const { potY, soilY } = potLevels(drop)
  // Vines have their own stream (hangingVines); leaves, crown and tassel use this one.
  const rand = seeded(seed * 31 + 17)
  const greens = tints.leafGreens.map((colour) => new Color(colour))
  const stem = new Color(tints.stem)
  const pick = () => greens[Math.floor(rand() * greens.length)]

  const pot = planterGeometry(potR, potH).translate(0, potY, 0)

  // Macrame: four cords from under the pot up to the hook, knotted at the rim, and a tassel under the pot.
  const cordParts: Part[] = []
  const apex = new Vector3(0, 0, 0)
  const under = new Vector3(0, potY - 0.05, 0)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    const rim = new Vector3(Math.cos(a) * potR * 1.06, potY + potH * 1.02, Math.sin(a) * potR * 1.06)
    const belly = new Vector3(Math.cos(a) * potR * 0.95, potY + potH * 0.35, Math.sin(a) * potR * 0.95)
    cordParts.push(between(under, belly, 0.0025, 0.0025, 5), between(belly, rim, 0.0025, 0.0025, 5), between(rim, apex, 0.0025, 0.0025, 5))
    cordParts.push({ geometry: new SphereGeometry(0.007, 8, 6), matrix: at(rim.x, rim.y + 0.03, rim.z) })
  }
  cordParts.push({ geometry: new SphereGeometry(0.012, 10, 8), matrix: at(0, -0.02, 0) })
  cordParts.push({ geometry: new SphereGeometry(0.014, 10, 8), matrix: at(under.x, under.y, under.z) })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    cordParts.push(between(under, new Vector3(Math.cos(a) * 0.012, under.y - 0.09 - rand() * 0.03, Math.sin(a) * 0.012), 0.002, 0.0015, 4))
  }
  const cords = mergeParts(cordParts)
  for (const part of cordParts) part.geometry.dispose()

  // Soil, vines and leaves, all baked into the canopy.
  const parts: Part[] = [{ geometry: new CircleGeometry(potR * 0.9, 40).rotateX(-Math.PI / 2), matrix: at(0, soilY, 0), colour: new Color(tints.soil) }]
  const leaf = hangingLeaf()
  const down = new Vector3(0, -1, 0)
  const place = (p: Vector3, tipDir: Vector3, faceDir: Vector3, size: number, twist: number) => {
    const yAxis = tipDir.clone().normalize()
    let zAxis = faceDir.clone().sub(yAxis.clone().multiplyScalar(faceDir.dot(yAxis))).normalize()
    const xAxis = new Vector3().crossVectors(yAxis, zAxis).normalize()
    zAxis = new Vector3().crossVectors(xAxis, yAxis)
    const matrix = new Matrix4().makeBasis(xAxis, yAxis, zAxis)
    matrix.multiply(new Matrix4().makeRotationY(twist))
    matrix.scale(new Vector3(size, size, size))
    matrix.setPosition(p)
    parts.push({ geometry: leaf, matrix, colour: pick() })
  }
  for (const { points, out } of hangingVines(options)) {
    const curve = new CatmullRomCurve3(points)
    parts.push({ geometry: new TubeGeometry(curve, 40, 0.0022, 5, false), colour: stem })
    const n = Math.floor(curve.getLength() / 0.042)
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 0.5)
      const position = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t)
      const side = i % 2 ? 1 : -1
      const sideways = new Vector3().crossVectors(tangent, out).normalize().multiplyScalar(side)
      // Leaves hang tip-down, turned outward, alternating left and right.
      const tip = down.clone().multiplyScalar(0.7).add(sideways.clone().multiplyScalar(0.6)).add(out.clone().multiplyScalar(0.25))
      const face = out.clone().add(new Vector3(0, 0.35, 0)).add(sideways.clone().multiplyScalar(0.3))
      place(position, tip, face, 0.06 - t * 0.028 + (rand() - 0.5) * 0.008, (rand() - 0.5) * 0.5)
    }
  }
  // The crown: bigger leaves standing up out of the pot.
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const base = new Vector3(out.x * potR * 0.4 * rand(), soilY + 0.005, out.z * potR * 0.4 * rand())
    const top = base.clone().addScaledVector(out, 0.03 + rand() * 0.05).add(new Vector3(0, 0.05 + rand() * 0.06, 0))
    parts.push({ ...between(base, top, 0.0025, 0.002, 5), colour: stem })
    const tip = out.clone().multiplyScalar(0.6).add(new Vector3(0, 0.5 + rand() * 0.4, 0))
    place(top, tip, out.clone().add(new Vector3(0, 0.6, 0)), 0.065 + rand() * 0.02, (rand() - 0.5) * 0.6)
  }
  const canopy = mergeParts(parts, { colours: true })
  for (const part of parts) if (part.geometry !== leaf) part.geometry.dispose()
  return { cords, pot, canopy }
}
