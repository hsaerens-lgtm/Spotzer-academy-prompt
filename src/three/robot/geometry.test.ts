import { ADA, bodyProfile, bodyRadiusAt } from './geometry'

test('the body profile is a closed egg, widest in its upper half', () => {
  const profile = bodyProfile(40)
  expect(profile[0].x).toBeCloseTo(0)
  expect(profile.at(-1)!.x).toBeLessThan(1e-6)
  expect(profile.at(-1)!.y).toBeCloseTo(ADA.bodyHeight)
  profile.slice(1).forEach((point, index) => expect(point.y).toBeGreaterThan(profile[index].y))
  const widest = profile.reduce((best, point) => (point.x > best.x ? point : best))
  expect(widest.y / ADA.bodyHeight).toBeGreaterThan(0.55)
  expect(widest.y / ADA.bodyHeight).toBeLessThan(0.8)
  expect(widest.x).toBeCloseTo(ADA.bodyRadius, 2)
})

test('the radius is zero at the tips and clamped outside the body', () => {
  expect(bodyRadiusAt(0)).toBe(0)
  expect(bodyRadiusAt(-1)).toBe(0)
  expect(bodyRadiusAt(ADA.bodyHeight + 1)).toBeLessThan(1e-6)
})
