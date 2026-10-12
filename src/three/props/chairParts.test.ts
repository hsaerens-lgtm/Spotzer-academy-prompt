import type { BufferGeometry } from 'three'
import { CHAIR, chairParts } from './chairParts'

function bounds(geometry: BufferGeometry) {
  geometry.computeBoundingBox()
  return geometry.boundingBox!
}

/** Vertices whose UV is not a pair of their own coordinates in metres (box projection: u is x or z, v is y or z). */
function nonMetreUVs(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-5
  let wrong = 0
  for (let i = 0; i < uv.count; i++) {
    const [x, y, z, u, v] = [position.getX(i), position.getY(i), position.getZ(i), uv.getX(i), uv.getY(i)]
    if (!(near(u, x) || near(u, z)) || !(near(v, y) || near(v, z))) wrong++
  }
  return wrong
}

test('chair parts stand on the floor with UVs in metres', () => {
  const { shell, base } = chairParts()
  const b = bounds(base)
  const s = bounds(shell)
  expect(b.min.y).toBeCloseTo(0, 6)
  // The seat rests on the seat plate; the back stays under 0.9 m.
  expect(s.min.y).toBeGreaterThanOrEqual(b.max.y - 0.001)
  expect(s.max.y).toBeLessThanOrEqual(CHAIR.backTop)
  expect(s.max.y).toBeGreaterThan(CHAIR.backTop - 0.05)
  for (const box of [b, s]) {
    for (const value of [box.min.x, box.max.x, box.min.z, box.max.z]) expect(Math.abs(value)).toBeLessThanOrEqual(CHAIR.half)
  }
  // Both parts are re-projected after merging (cylinders come with 0..1 UVs).
  expect(nonMetreUVs(base)).toBe(0)
  expect(nonMetreUVs(shell)).toBe(0)
})

test('all chairs share one geometry per part', () => {
  const first = chairParts()
  const second = chairParts()
  expect(second).toBe(first)
  expect(second.shell).toBe(first.shell)
  expect(second.base).toBe(first.base)
  expect(first.shell).not.toBe(first.base)
})
