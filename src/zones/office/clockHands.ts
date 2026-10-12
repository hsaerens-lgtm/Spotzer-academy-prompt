import { BufferGeometry, type Material, type Mesh, type Object3D } from 'three'
import { GLASS_MATERIAL, MODEL_PARTS } from '../../three/assets'

/*
 * The hands and the case of the wall_clock model. Angles are radians clockwise from 12 o'clock, seen from the front of
 * the dial (+z); the dial lies in the model's XY plane with the hands' axis at the origin, so a hand turns with its
 * node's rotation.z.
 */

/**
 * Where the second hand is parked: 20 s, 120 degrees. The clock shows 14:00, 19:30 and 23:00, and the second hand does
 * not run; on 12 it covered the minute hand at 14:00 and at 23:00. At 120 degrees it is at least 60 degrees from the hour
 * and the minute hands at all three times.
 */
export const SECOND_HAND_REST = (20 * Math.PI) / 30

/** Rest angle of a hand: the direction of its vertex farthest from the axis (its tip), atan2(x, y). */
export function handRestAngle(positions: ArrayLike<number>, itemSize = 3): number {
  let farthest = -1
  let angle = 0
  for (let i = 0; i + 1 < positions.length; i += itemSize) {
    const x = positions[i]
    const y = positions[i + 1]
    const distance = x * x + y * y
    if (distance > farthest) {
      farthest = distance
      angle = Math.atan2(x, y)
    }
  }
  return angle
}

/** Hand angles for a time of day in minutes after midnight. The second hand is parked at SECOND_HAND_REST. */
export function handAngles(minutes: number): { hour: number; minute: number; second: number } {
  return { hour: ((minutes / 60) % 12) * (Math.PI / 6), minute: (minutes % 60) * (Math.PI / 30), second: SECOND_HAND_REST }
}

/** rotation.z that turns a hand from its rest angle to `target`: clockwise seen from +z is a negative z rotation. */
export function handRotationZ(target: number, rest: number): number {
  return -(target - rest)
}

const HAND_NODES: readonly string[] = Object.values(MODEL_PARTS.clockHands)

/**
 * Is this mesh of the clock model its case? The model is one mesh for the case with its dial, one for the glass over
 * it, and a mesh node per hand.
 */
export function isClockCase(mesh: Mesh): boolean {
  const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (materials.some((material) => GLASS_MATERIAL.test(material.name))) return false
  for (let node: Object3D | null = mesh; node; node = node.parent) if (HAND_NODES.includes(node.name)) return false
  return true
}

/**
 * Radius, in metres, from which the case's outer shell starts. The bezel's inner wall, where it meets the rim of the dial,
 * stands at 0.14 to 0.145 m from the axis; the front of the bezel and its outer wall are at 0.15 to 0.16 m.
 */
export const CASE_RING_FROM = 0.1475

/**
 * The triangles of the case mesh that lie wholly on its outer shell (the front of the bezel, its outer wall and the
 * back): the geometry the hover outline is drawn from. The outline of the whole case-and-dial mesh draws a second, thin
 * ring just inside the bezel, from its inner wall and the rim of the dial. The positions are the case's own, shared.
 */
export function caseRing(geometry: BufferGeometry, from = CASE_RING_FROM): BufferGeometry {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (!index) throw new Error('caseRing needs an indexed geometry')
  const outside = (vertex: number) => Math.hypot(position.getX(vertex), position.getY(vertex)) >= from
  const kept: number[] = []
  for (let t = 0; t < index.count; t += 3) {
    const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
    if (outside(a) && outside(b) && outside(c)) kept.push(a, b, c)
  }
  const ring = new BufferGeometry()
  ring.setAttribute('position', position)
  const normal = geometry.getAttribute('normal')
  if (normal) ring.setAttribute('normal', normal)
  ring.setIndex(kept)
  return ring
}
