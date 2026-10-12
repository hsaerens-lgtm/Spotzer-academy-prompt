import { BoxGeometry, Triangle, Vector3, type BufferGeometry } from 'three'
import { withoutUnderside } from './underside'

/** The normal of every triangle of an indexed geometry. */
function normals(geometry: BufferGeometry): Vector3[] {
  const index = geometry.getIndex()!
  const position = geometry.getAttribute('position')
  const corner = (i: number) => new Vector3().fromBufferAttribute(position, index.getX(i))
  const result: Vector3[] = []
  for (let i = 0; i < index.count; i += 3) result.push(new Triangle(corner(i), corner(i + 1), corner(i + 2)).getNormal(new Vector3()))
  return result
}

// The floor contact shadow records every face that looks down from 3 cm under the floor's surface upward: the rug's
// underside, lying on the floor, would shade the whole rug.
test('a box without its underside keeps its five other faces, none looking down', () => {
  const box = new BoxGeometry(4.2, 0.012, 6.8)
  expect(normals(box).filter((normal) => normal.y < -0.5)).toHaveLength(2)
  const open = withoutUnderside(box)
  expect(open).toBe(box)
  const kept = normals(open)
  expect(kept).toHaveLength(10)
  expect(kept.filter((normal) => normal.y < -0.5)).toEqual([])
  expect(kept.filter((normal) => normal.y > 0.5)).toHaveLength(2)
  // One material for the whole box: no group still points at the dropped face.
  expect(open.groups).toEqual([])
})
