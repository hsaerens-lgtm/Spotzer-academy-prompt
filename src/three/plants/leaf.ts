// Ported from Horn.os (owner's project): js/lib/plants.js
import { Shape, ShapeGeometry, Vector2, type BufferGeometry } from 'three'

/*
 * One leaf: a flat outline bent twice, down along its length (droop) and up along its width (fold). A flat card
 * vanishes edge-on and catches the light as one tone; the second bend makes a canopy read as many surfaces.
 */

/**
 * Half-width of the leaf as a fraction of its widest point, along its length. The exponent separates a laurel from
 * a banana: below 0.5 the leaf is nearly parallel-sided with a sudden tip, above 0.8 it is almost a circle.
 */
const PROFILE = {
  oval: (t: number) => Math.pow(Math.sin(Math.PI * t), 0.6),
  heart: (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.48),
  blade: (t: number) => Math.pow(Math.sin(Math.PI * t), 0.26),
  round: (t: number) => Math.pow(Math.sin(Math.PI * t), 0.9),
}

/**
 * The slits of a monstera leaf, as bands of `t` where the outline dives toward the midrib. Three, cut two fifths of
 * the way in: four deep slits chop the leaf into five lobes, which reads as a conifer at screen size.
 */
const SLITS = [0.34, 0.56, 0.76]
const cut = (t: number) => (SLITS.some((c) => Math.abs(t - c) < 0.026) ? 0.44 : 1)

export interface LeafOptions {
  kind?: keyof typeof PROFILE
  len?: number
  wid?: number
  split?: boolean
  steps?: number
  droop?: number
  fold?: number
}

/**
 * One leaf growing along +y from the origin, facing +z, in metres. `split` adds the monstera slits; `steps` is per
 * side (small leaves get fewer outline points). UVs are the outline coordinates, in metres.
 */
export function leafGeometry({ kind = 'oval', len = 0.2, wid = 0.1, split = false, steps = 26, droop = 0.35, fold = 0.35 }: LeafOptions = {}): BufferGeometry {
  const profile = PROFILE[kind]
  const points: Vector2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = profile(t) * (split ? cut(t) : 1)
    points.push(new Vector2((r * wid) / 2, t * len))
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    const r = profile(t) * (split ? cut(t) : 1)
    points.push(new Vector2((-r * wid) / 2, t * len))
  }
  const geometry = new ShapeGeometry(new Shape(points))
  // `droop` arcs the leaf away from the stem, quadratically so the base stays stiff; `fold` lifts both edges
  // relative to the midrib. A bent leaf keeps its arc length, so it covers less ground.
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const t = Math.max(0, position.getY(i) / len)
    position.setZ(i, -droop * len * t * t + fold * Math.abs(x))
    position.setY(i, position.getY(i) * (1 - 0.14 * t * t))
  }
  geometry.computeVertexNormals()
  return geometry
}
