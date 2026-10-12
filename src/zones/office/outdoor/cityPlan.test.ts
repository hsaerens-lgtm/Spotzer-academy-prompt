import { CAMERA, GLAZING } from '../layout'
import { CITY_STYLES, OUTDOOR, buildingPlan, cityLayout, seeded } from './cityPlan'

test('the city is the same on every run', () => {
  expect(buildingPlan()).toEqual(buildingPlan(7))
  expect(cityLayout()).toEqual(cityLayout(7))
  expect(buildingPlan(8)).not.toEqual(buildingPlan(7))
  expect(buildingPlan().length).toBeGreaterThan(150)
  // Horn.os' generator: the same numbers for the same seed, always in [0, 1).
  const a = seeded(19)
  const b = seeded(19)
  for (let i = 0; i < 1000; i++) {
    const n = a()
    expect(n).toBe(b())
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThan(1)
  }
})

test('no building stands between the fa\u00e7ade and the park', () => {
  for (const b of buildingPlan()) expect(b.x + b.w / 2).toBeLessThanOrEqual(OUTDOOR.park.x1)
})

test('only towers rise above 55 m, and none above 170 m', () => {
  const plan = buildingPlan()
  const towers = plan.filter((b) => b.h > 55)
  expect(towers.length).toBeGreaterThan(0)
  for (const b of plan) {
    expect(b.h).toBeGreaterThanOrEqual(10)
    expect(b.h).toBeLessThan(170)
  }
  // A building above 55 m is a tower: a glass or concrete one, with a warning light on top.
  for (const b of towers) expect([CITY_STYLES.glass, CITY_STYLES.concrete]).toContain(b.style)
  expect(cityLayout().beacons).toHaveLength(towers.length)
})

test('the sky dome fits inside the camera far plane', () => {
  expect(OUTDOOR.domeRadius + Math.abs(OUTDOOR.originX) + 8).toBeLessThan(CAMERA.far)
  // So do the farthest building corners, seen from anywhere in the room.
  for (const b of buildingPlan()) {
    const x = Math.abs(b.x + OUTDOOR.originX) + b.w / 2 + 8
    const z = Math.abs(b.z) + b.d / 2 + 8
    expect(Math.hypot(x, z, OUTDOOR.groundY - b.h)).toBeLessThan(CAMERA.far)
  }
})

test('the dome holds the whole city, so it can be drawn after it with the depth test on', () => {
  // The dome is centred on the outdoor group's origin, at the height of the office floor (y = 0).
  for (const b of buildingPlan()) {
    const height = Math.max(Math.abs(OUTDOOR.groundY), Math.abs(OUTDOOR.groundY + b.h))
    expect(Math.hypot(Math.abs(b.x) + b.w / 2, Math.abs(b.z) + b.d / 2, height)).toBeLessThan(OUTDOOR.domeRadius)
  }
})

test('the ground lies far below the office floor, the park beyond the facade', () => {
  expect(OUTDOOR.groundY).toBeLessThanOrEqual(-20) // eighth floor
  // Between the facade and the park runs Horn.os' street, out of every camera's view and not built.
  expect(OUTDOOR.park.x0 + OUTDOOR.originX).toBeLessThan(GLAZING.side.x)
  expect(OUTDOOR.park.x1).toBeLessThan(OUTDOOR.park.x0)
})
