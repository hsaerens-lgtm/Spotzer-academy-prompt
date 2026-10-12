// @vitest-environment node
import { albedo, fakeTextureSets, luminance } from '../test/albedo'
import { isTextured } from './audit'
import { ENV_MAP_INTENSITY, buildMaterials } from './materials'

/*
 * The black parts of the office (chair bases, table legs, sofa legs, brackets, TV stand, microphone heads, the wall screen's
 * bezel, the glazing frame) are a black powder-coat on steel and aluminium, a dielectric finish that catches highlights.
 * As a metal with a tint of 0.023 over a colour map of 0.11 (a reflectance of 0.0026) they reflected nothing at all and
 * rendered as flat silhouettes (0 to 6 of 255 in the day overview, the highlights of the lights gone).
 */

test('the black parts are a dielectric powder-coat that keeps its normal, roughness and AO maps', async () => {
  const sets = fakeTextureSets()
  const { blackMetal } = buildMaterials(sets)
  // No metalness: a metal's base colour is its reflectance, and the black of a coat is an albedo.
  expect(blackMetal.metalness).toBe(0)
  expect(blackMetal.metalnessMap).toBeNull()
  // The texture set's own maps.
  expect(blackMetal.map).toBe(sets.blackMetal.color)
  expect(blackMetal.normalMap).toBe(sets.blackMetal.normal)
  expect(blackMetal.roughnessMap).toBe(sets.blackMetal.arm)
  expect(blackMetal.aoMap).toBe(sets.blackMetal.arm)
  expect(blackMetal.envMapIntensity).toBe(ENV_MAP_INTENSITY.surface)
  expect(isTextured(blackMetal)).toBe(true)
  // A believable black powder-coat: an albedo (tint times the mean of the colour map) of 0.03 to 0.05, linear. Black, not grey.
  const value = luminance(await albedo(blackMetal, sets))
  expect(value).toBeGreaterThanOrEqual(0.03)
  expect(value).toBeLessThanOrEqual(0.05)
})

test('the brushed metal stays a metal without a colour map', () => {
  const sets = fakeTextureSets()
  const { brushedMetal } = buildMaterials(sets)
  expect(brushedMetal.metalness).toBe(1)
  expect(brushedMetal.metalnessMap).toBe(sets.brushedMetal.arm)
  expect(brushedMetal.map).toBeNull()
})
