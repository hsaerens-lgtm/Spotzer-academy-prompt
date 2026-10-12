// Ported from Horn.os (owner's project): js/lib/shapes.js (roundedBox, along, between)
import { CylinderGeometry, ExtrudeGeometry, Matrix4, Quaternion, Shape, Vector3, type BufferGeometry } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Part } from './merge'
import { metreUVs } from './uv'

/*
 * Rounded shapes for the furniture built in code. Nothing in the real world has a knife edge: a BoxGeometry does, and a
 * room built from them reads as blocked out. Three changes from Horn.os: the sizes are exact (the bevel is taken inside
 * the outline instead of growing it), the UVs are in metres (each material repeats its texture per tileMetres), and the
 * geometries are indexed (drei's Outlines then outlines a copy instead of rewriting the normals of a shared geometry).
 */

const cache = new Map<string, BufferGeometry>()

function roundedRect(w: number, h: number, r: number): Shape {
  const shape = new Shape()
  const x = w / 2
  const y = h / 2
  const radius = Math.min(r, x * 0.999, y * 0.999)
  shape.moveTo(-x + radius, -y)
  shape.lineTo(x - radius, -y)
  shape.quadraticCurveTo(x, -y, x, -y + radius)
  shape.lineTo(x, y - radius)
  shape.quadraticCurveTo(x, y, x - radius, y)
  shape.lineTo(-x + radius, y)
  shape.quadraticCurveTo(-x, y, -x, y - radius)
  shape.lineTo(-x, -y + radius)
  shape.quadraticCurveTo(-x, -y, -x + radius, -y)
  return shape
}

/**
 * A centred box of exactly w x h x d with every edge softened by `r` (capped at a third of the smallest side, so a
 * thin panel never collapses), UVs in metres. Cached by its arguments: never dispose the result.
 */
export function roundedBox(w: number, h: number, d: number, r = 0.008, curve = 3): BufferGeometry {
  const radius = Math.max(0.0005, Math.min(r, Math.min(w, h, d) / 3))
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${radius.toFixed(4)}|${curve}`
  const hit = cache.get(key)
  if (hit) return hit
  // Extrude along the thinnest axis (Horn.os): the two large faces are the rounded rectangle itself.
  let a: number
  let b: number
  let t: number
  let spin: 'x' | 'y' | null
  if (d <= w && d <= h) [a, b, t, spin] = [w, h, d, null]
  else if (h <= w && h <= d) [a, b, t, spin] = [w, d, h, 'x']
  else [a, b, t, spin] = [d, h, w, 'y']
  const bevel = Math.min(radius, t / 2.01)
  // The bevel pushes the outline out by `bevel` all round: start from an outline that much smaller.
  const extruded = new ExtrudeGeometry(roundedRect(a - 2 * bevel, b - 2 * bevel, Math.max(0.0005, radius - bevel)), {
    depth: t - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: curve,
    curveSegments: curve + 1,
  })
  // The extrusion runs from -bevel to t - bevel: centre it.
  extruded.translate(0, 0, -t / 2 + bevel)
  if (spin === 'x') extruded.rotateX(-Math.PI / 2)
  else if (spin === 'y') extruded.rotateY(Math.PI / 2)
  const geometry = mergeVertices(metreUVs(extruded))
  extruded.dispose()
  cache.set(key, geometry)
  return geometry
}

/**
 * A stadium-shaped slab (the meeting table top): `width` along x, `length` along z with semicircular ends of radius
 * width / 2, from y = 0 to y = thickness, its edge rounded by `edgeRadius`. Exact size, UVs in metres, indexed.
 */
export function racetrackTop(width: number, length: number, thickness: number, edgeRadius: number): BufferGeometry {
  const bevel = Math.max(0.0005, Math.min(edgeRadius, thickness / 2.01, width / 4))
  const r = width / 2 - bevel
  const straight = Math.max(0, (length - width) / 2)
  const shape = new Shape()
  shape.moveTo(r, -straight)
  shape.lineTo(r, straight)
  shape.absarc(0, straight, r, 0, Math.PI, false)
  shape.lineTo(-r, -straight)
  shape.absarc(0, -straight, r, Math.PI, Math.PI * 2, false)
  const extruded = new ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 32,
  })
  // Extrusion from -bevel to thickness - bevel, then laid flat: shape y becomes -z (symmetric), extrusion becomes +y.
  extruded.translate(0, 0, bevel)
  extruded.rotateX(-Math.PI / 2)
  const geometry = mergeVertices(metreUVs(extruded))
  extruded.dispose()
  return geometry
}

const UP = new Vector3(0, 1, 0)

/**
 * A tapered cylinder from `a` (radius r0) to `b` (radius r1), as a part for mergeParts: legs, stems and spokes join
 * their two points exactly. Its UVs are not in metres: run metreUVs on the merged geometry.
 */
export function between(a: Vector3, b: Vector3, r0: number, r1: number, segments = 14): Part {
  const direction = b.clone().sub(a)
  return {
    geometry: new CylinderGeometry(r1, r0, direction.length(), segments, 1, false),
    matrix: new Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()),
      new Vector3(1, 1, 1),
    ),
  }
}
