import { BufferGeometry, type Material, type Mesh, type Object3D } from 'three'
import { GLASS_MATERIAL, MODEL_PARTS } from '../../three/assets'

/*
 * The case of the wall_clock model and the ring its hover outline is drawn from. The model is one mesh for the case
 * with its dial, one for the glass over it, and a mesh node per hand; the dial lies in the model's XY plane with the
 * hands' axis at the origin, its front toward +z.
 */

const HAND_NODES: readonly string[] = Object.values(MODEL_PARTS.clockHands)

/** Is this mesh of the clock model its case? Neither the glass nor a hand (clockHands.ts turns the hands). */
export function isClockCase(mesh: Mesh): boolean {
  const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  if (materials.some((material) => GLASS_MATERIAL.test(material.name))) return false
  for (let node: Object3D | null = mesh; node; node = node.parent) if (HAND_NODES.includes(node.name)) return false
  return true
}

/**
 * Radius, in metres, from which the case's outer shell starts. The bezel's inner wall, where it meets the rim of the dial,
 * stands at 0.14 to 0.143 m from the axis; the front of the bezel and its outer wall are at 0.15 to 0.16 m
 * (clockCase.test.ts measures both on the model).
 */
export const CASE_RING_FROM = 0.1475

/**
 * The triangles of the case mesh that lie wholly on its outer shell (the front of the bezel, its outer wall and the
 * back): the geometry the hover outline is drawn from. The outline of the whole case-and-dial mesh draws a second, thin
 * ring just inside the bezel, from its inner wall and the rim of the dial. The positions are the case's own, shared.
 *
 * A case without an index (none in the office: src/assets/assets.test.ts checks every model) cannot be cut by
 * triangle: its outline then rings the whole case, from a copy. drei's Outlines rewrites the normals of a geometry
 * without an index and disposes it on unhover: the case's own geometry must not be the one it gets.
 */
export function caseRing(geometry: BufferGeometry, from = CASE_RING_FROM): BufferGeometry {
  const index = geometry.getIndex()
  if (!index) return geometry.clone()
  const position = geometry.getAttribute('position')
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
