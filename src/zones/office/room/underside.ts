import { Triangle, Vector3, type BufferGeometry } from 'three'

/**
 * Drops the faces of an indexed geometry that look straight down (normal y below -0.5), in place, and returns it. For a
 * slab lying on the floor, such as the rug: the floor contact shadow (FloorContactShadow) records every face that looks
 * down from just under the floor's surface upward, and the rug's underside would shade the whole rug. Nobody sees it.
 */
export function withoutUnderside<T extends BufferGeometry>(geometry: T): T {
  const index = geometry.getIndex()
  if (!index) throw new Error('withoutUnderside needs an indexed geometry')
  const position = geometry.getAttribute('position')
  const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()]
  const normal = new Vector3()
  const kept: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const corners = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    a.fromBufferAttribute(position, corners[0])
    b.fromBufferAttribute(position, corners[1])
    c.fromBufferAttribute(position, corners[2])
    if (Triangle.getNormal(a, b, c, normal).y < -0.5) continue
    kept.push(...corners)
  }
  geometry.setIndex(kept)
  geometry.clearGroups()
  return geometry
}
