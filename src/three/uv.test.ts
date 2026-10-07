import { BoxGeometry, PlaneGeometry } from 'three'
import { metreUVs } from './uv'

/** Range of u and v over the vertices whose normal points along `axis` (0 x, 1 y, 2 z). */
function faceExtent(geometry: BoxGeometry, axis: number): [number, number] {
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const us: number[] = []
  const vs: number[] = []
  for (let i = 0; i < normal.count; i++) {
    if (Math.abs([normal.getX(i), normal.getY(i), normal.getZ(i)][axis]) < 0.5) continue
    us.push(uv.getX(i))
    vs.push(uv.getY(i))
  }
  return [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)]
}

test('box faces get UVs in metres', () => {
  const box = new BoxGeometry(2, 1, 0.5)
  expect(metreUVs(box)).toBe(box)
  const [x, y, z] = [0, 1, 2].map((axis) => faceExtent(box, axis))
  // x faces: u along z, v along y; y faces: u along x, v along z; z faces: u along x, v along y.
  expect(x[0]).toBeCloseTo(0.5)
  expect(x[1]).toBeCloseTo(1)
  expect(y[0]).toBeCloseTo(2)
  expect(y[1]).toBeCloseTo(0.5)
  expect(z[0]).toBeCloseTo(2)
  expect(z[1]).toBeCloseTo(1)
})

test('offset and swap move and turn the UVs', () => {
  // A 2 x 1 m plane facing +z: u = x, v = y.
  const plain = metreUVs(new PlaneGeometry(2, 1)).getAttribute('uv')
  const moved = metreUVs(new PlaneGeometry(2, 1), { offset: [0.25, 0.5] }).getAttribute('uv')
  const turned = metreUVs(new PlaneGeometry(2, 1), { swap: true }).getAttribute('uv')
  const positions = new PlaneGeometry(2, 1).getAttribute('position')
  for (let i = 0; i < plain.count; i++) {
    expect(plain.getX(i)).toBeCloseTo(positions.getX(i))
    expect(plain.getY(i)).toBeCloseTo(positions.getY(i))
    expect(moved.getX(i)).toBeCloseTo(positions.getX(i) + 0.25)
    expect(moved.getY(i)).toBeCloseTo(positions.getY(i) + 0.5)
    expect(turned.getX(i)).toBeCloseTo(positions.getY(i))
    expect(turned.getY(i)).toBeCloseTo(positions.getX(i))
  }
})
