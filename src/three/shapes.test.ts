import { Box3, CylinderGeometry, Vector3, type BufferGeometry } from 'three'
import { between, racetrackTop, roundedBox } from './shapes'

function bounds(geometry: BufferGeometry): Box3 {
  geometry.computeBoundingBox()
  return geometry.boundingBox!
}

function expectBox(geometry: BufferGeometry, min: [number, number, number], max: [number, number, number]) {
  const box = bounds(geometry)
  box.min.toArray().forEach((value, i) => expect(value).toBeCloseTo(min[i], 5))
  box.max.toArray().forEach((value, i) => expect(value).toBeCloseTo(max[i], 5))
}

/** Largest extent of the uv attribute along u or v. */
function uvSpan(geometry: BufferGeometry): number {
  const uv = geometry.getAttribute('uv')
  let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (let i = 0; i < uv.count; i++) {
    u0 = Math.min(u0, uv.getX(i))
    u1 = Math.max(u1, uv.getX(i))
    v0 = Math.min(v0, uv.getY(i))
    v1 = Math.max(v1, uv.getY(i))
  }
  return Math.max(u1 - u0, v1 - v0)
}

test('the racetrack top spans exactly its width and length', () => {
  const top = racetrackTop(2.5, 5.0, 0.04, 0.015)
  expectBox(top, [-1.25, 0, -2.5], [1.25, 0.04, 2.5])
  expect(top.index).not.toBeNull()
  // Straight sides for |z| <= 1.25, semicircular ends of radius 1.25 beyond: no vertex outside the stadium
  // (to 0.1 mm: the bevel of a polygonal arc bulges by a few micrometres at its corners).
  const position = top.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const beyond = Math.max(0, Math.abs(position.getZ(i)) - 1.25)
    expect(Math.hypot(x, beyond)).toBeLessThanOrEqual(1.25 + 1e-4)
  }
  // UVs in metres: the top face spans almost 5 m along its length (the rounded edge takes the last millimetres).
  expect(uvSpan(top)).toBeGreaterThan(4.9)
  expect(uvSpan(top)).toBeLessThanOrEqual(5 + 1e-6)
})

test('rounded boxes cap their radius at a third of the smallest side', () => {
  // A 6 cm board asked for a 50 cm radius gets 2 cm, the same geometry as asking for 2 cm.
  expect(roundedBox(1, 1, 0.06, 0.5)).toBe(roundedBox(1, 1, 0.06, 0.02))
  expectBox(roundedBox(1, 1, 0.06, 0.5), [-0.5, -0.5, -0.03], [0.5, 0.5, 0.03])
  // Exact sizes whichever axis is the thinnest (the extrusion axis turns with it).
  expectBox(roundedBox(0.5, 0.3, 0.1, 0.02), [-0.25, -0.15, -0.05], [0.25, 0.15, 0.05])
  expectBox(roundedBox(0.5, 0.1, 0.4, 0.02), [-0.25, -0.05, -0.2], [0.25, 0.05, 0.2])
  expectBox(roundedBox(0.1, 0.5, 0.3, 0.02), [-0.05, -0.25, -0.15], [0.05, 0.25, 0.15])
})

test('rounded boxes are cached by size', () => {
  const panel = roundedBox(0.34, 0.22, 0.012, 0.006)
  expect(roundedBox(0.34, 0.22, 0.012, 0.006)).toBe(panel)
  expect(roundedBox(0.34, 0.22, 0.013, 0.006)).not.toBe(panel)
  expect(panel.index).not.toBeNull()
  expect(Object.keys(panel.attributes).sort()).toEqual(['normal', 'position', 'uv'])
  expect(uvSpan(panel)).toBeLessThanOrEqual(0.34 + 1e-6)
})

test('between joins its two points', () => {
  const a = new Vector3(0.1, 0.06, 0)
  const b = new Vector3(0.3, 0.02, 0.2)
  const part = between(a, b, 0.016, 0.011, 10)
  const length = a.distanceTo(b)
  const cylinder = part.geometry as CylinderGeometry
  expect(cylinder.parameters).toMatchObject({ radiusBottom: 0.016, radiusTop: 0.011, radialSegments: 10 })
  expect(cylinder.parameters.height).toBeCloseTo(length)
  const start = new Vector3(0, -length / 2, 0).applyMatrix4(part.matrix!)
  const end = new Vector3(0, length / 2, 0).applyMatrix4(part.matrix!)
  expect(start.distanceTo(a)).toBeLessThan(1e-9)
  expect(end.distanceTo(b)).toBeLessThan(1e-9)
})
