import { Color } from 'three'
import { tints } from '../../../three/tints'
import { PACHIRA } from './pachira'
import { soilGeometry, soilSpeckle } from './soil'

/*
 * The soil of the money tree's planter: a skin of potting soil, not a disc. It rises to a low dome under the trunk,
 * is uneven by a millimetre or two and dips a little at the wall, where its edge goes into the clay.
 */

const { soil } = PACHIRA

test('the soil is a domed, uneven skin of its radius, facing up', () => {
  const geometry = soilGeometry(soil)
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  expect(position.count).toBe(normal.count)
  expect(position.count).toBe(uv.count)
  let widest = 0
  let low = Infinity
  let high = -Infinity
  for (let i = 0; i < position.count; i++) {
    widest = Math.max(widest, Math.hypot(position.getX(i), position.getZ(i)))
    low = Math.min(low, position.getY(i))
    high = Math.max(high, position.getY(i))
    // Facing up, tilted by the dome and the bumps only.
    expect(normal.getY(i)).toBeGreaterThan(0.7)
    expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
    expect(uv.getX(i)).toBeLessThanOrEqual(1)
    expect(uv.getY(i)).toBeGreaterThanOrEqual(0)
    expect(uv.getY(i)).toBeLessThanOrEqual(1)
  }
  expect(widest).toBeCloseTo(soil.radius, 6)
  // The surface stays within the dome above the soil line and the dip under it.
  expect(high).toBeLessThanOrEqual(soil.dome + soil.bump + 1e-9)
  expect(low).toBeGreaterThanOrEqual(-(soil.drop + soil.bump) - 1e-9)
  // Domed: the middle stands higher than the edge, by about the dome.
  const heightAt = (radius: number) => {
    const found: number[] = []
    for (let i = 0; i < position.count; i++) if (Math.abs(Math.hypot(position.getX(i), position.getZ(i)) - radius) < 1e-6) found.push(position.getY(i))
    return found
  }
  const middle = heightAt(0)
  expect(middle).toHaveLength(1)
  const edge = heightAt(soil.radius)
  expect(middle[0] - edge.reduce((a, b) => a + b, 0) / edge.length).toBeGreaterThan(soil.dome * 0.5)
  // Uneven: on a ring half way out, the height varies by more than a millimetre.
  const mid =Array.from({ length: position.count }, (_, i) => i).filter((i) => {
    const r = Math.hypot(position.getX(i), position.getZ(i))
    return r > soil.radius * 0.45 && r < soil.radius * 0.55
  })
  const heights = mid.map((i) => position.getY(i))
  expect(mid.length).toBeGreaterThan(50)
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.001)
})

test('the same seed makes the same soil and another seed another', () => {
  const a = soilGeometry(soil)
  const b = soilGeometry(soil)
  expect(Array.from(b.getAttribute('position').array)).toEqual(Array.from(a.getAttribute('position').array))
  const other = soilGeometry({ ...soil, seed: soil.seed + 1 })
  expect(Array.from(other.getAttribute('position').array)).not.toEqual(Array.from(a.getAttribute('position').array))
})

test('the speckle is a warm brown derived from the soil tint', () => {
  const { base, dots } = soilSpeckle(tints.soil)
  const hsl = (colour: string) => new Color(colour).getHSL({ h: 0, s: 0, l: 0 })
  const soilHsl = hsl(tints.soil)
  // Lighter than the bare tint, which is nearly black: a surface of that colour reads black in the shade of the corner.
  expect(hsl(base).l).toBeGreaterThan(soilHsl.l * 1.5)
  expect(dots.length).toBeGreaterThanOrEqual(3)
  expect(Math.min(...dots.map((dot) => hsl(dot).l))).toBeLessThan(hsl(base).l)
  expect(Math.max(...dots.map((dot) => hsl(dot).l))).toBeGreaterThan(hsl(base).l)
  for (const colour of [base, ...dots]) {
    const { h, s } = hsl(colour)
    expect(Math.abs(h - soilHsl.h), colour).toBeLessThan(0.05)
    expect(s, colour).toBeGreaterThan(0.1)
  }
})
