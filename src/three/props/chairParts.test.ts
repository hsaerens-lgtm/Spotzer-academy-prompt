import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3, type BufferGeometry } from 'three'
import { SIZES } from '../../zones/office/footprints'
import { CHAIR, casterPositions, chairParts } from './chairParts'

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

/** Height of the first surface of `geometry` met by a ray going straight down at (x, z). */
function surfaceHeight(geometry: BufferGeometry, x: number, z: number): number {
  const ray = new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0))
  const [hit] = ray.intersectObject(new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide })))
  return hit ? hit.point.y : -Infinity
}

/** Vertices of `geometry` between heights y0 and y1 whose |x| is at least `outside`. */
function countOutside(geometry: BufferGeometry, y0: number, y1: number, outside: number): number {
  const position = geometry.getAttribute('position')
  let count = 0
  for (let i = 0; i < position.count; i++) {
    const [x, y] = [position.getX(i), position.getY(i)]
    if (y >= y0 && y <= y1 && Math.abs(x) >= outside) count++
  }
  return count
}

test('the chair rolls on five casters, evenly spread on the floor around its column', () => {
  const casters = casterPositions()
  expect(casters).toHaveLength(CHAIR.spokes)
  expect(CHAIR.spokes).toBe(5)
  for (const caster of casters) {
    expect(caster.y).toBeCloseTo(CHAIR.casterRadius, 6)
    expect(Math.hypot(caster.x, caster.z)).toBeCloseTo(CHAIR.spokeReach, 6)
  }
  const angles = casters.map((c) => Math.atan2(c.z, c.x)).sort((a, b) => a - b)
  for (let k = 1; k < angles.length; k++) expect(angles[k] - angles[k - 1]).toBeCloseTo((2 * Math.PI) / 5, 6)
  // The base stands on its casters: the frame (spokes, casters) reaches the floor.
  expect(bounds(chairParts().frame).min.y).toBeCloseTo(0, 6)
})

test('seat, back and arms sit at office-chair heights', () => {
  const { fabric, frame } = chairParts()
  // The seat cushion's top, at the middle of the seat.
  expect(surfaceHeight(fabric, 0, 0.05)).toBeCloseTo(CHAIR.seatTop, 3)
  // The back's top.
  expect(bounds(fabric).max.y).toBeGreaterThan(CHAIR.backTop - 0.03)
  expect(bounds(fabric).max.y).toBeLessThanOrEqual(CHAIR.backTop + 1e-6)
  // Two armrests, outside the seat cushion, at armrest height.
  const outsideSeat = CHAIR.seatHalfWidth + 0.02
  expect(countOutside(frame, CHAIR.armTop - 0.03, CHAIR.armTop, outsideSeat)).toBeGreaterThan(0)
  expect(CHAIR.armTop).toBeGreaterThan(CHAIR.seatTop + 0.15)
})

test('every part fits the chair footprint, with UVs in metres', () => {
  const parts = chairParts()
  for (const [name, geometry] of Object.entries(parts)) {
    const box = bounds(geometry)
    expect(box.min.y, name).toBeGreaterThanOrEqual(-1e-6)
    expect(box.max.y, name).toBeLessThanOrEqual(CHAIR.backTop + 1e-6)
    for (const value of [box.min.x, box.max.x, box.min.z, box.max.z]) expect(Math.abs(value), name).toBeLessThanOrEqual(CHAIR.half + 1e-6)
    expect(nonMetreUVs(geometry), name).toBe(0)
  }
  // The layout's footprint is the chair's.
  expect(SIZES.chair).toEqual([2 * CHAIR.half, CHAIR.backTop, 2 * CHAIR.half])
})

test('all chairs share one geometry per part', () => {
  const first = chairParts()
  const second = chairParts()
  expect(second).toBe(first)
  expect(new Set([first.fabric, first.frame, first.chrome]).size).toBe(3)
})
