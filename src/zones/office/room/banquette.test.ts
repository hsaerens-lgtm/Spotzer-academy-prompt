// @vitest-environment node
import type { MeshStandardMaterial } from 'three'
import { albedo, fakeTextureSets, luminance } from '../../../test/albedo'
import { buildMaterials } from '../../../three/materials'
import { banquetteBoxes } from './plan'

/*
 * The front of the banquette was pure black (0, 0, 0 by day, Task 14 review). The cause was its material, not the light:
 * the base was the shared blackMetal, a metal (no diffuse term) whose reflectance was its tint times a colour map that
 * is already a dark grey (mean sRGB 93): 0.023 * 0.11 = 0.0026, a black body. A beige wall in the same shade reads
 * sRGB 21 there; a surface of albedo 0.0026 reads 0. Measured in the scene by day (face pixels only): tint x map 0.0026
 * -> luma 0, 0.0235 -> 2.4, 0.047 -> 6.8, 0.109 -> 20.
 * (blackMetal has since become a black powder-coat of albedo 0.03 to 0.05, powderCoat.test.ts: the base stays this lighter
 * charcoal because it is a large face seen in shade.)
 */

test('the front of the banquette is painted steel that the light can reach, not a black metal', async () => {
  const sets = fakeTextureSets()
  const base = banquetteBoxes().find((box) => box.name === 'banquette-base')!
  const material = buildMaterials(sets)[base.material] as MeshStandardMaterial
  // A dielectric: a metal has no diffuse term, so in the shade of this face (0.07 of a white surface's light) it shows
  // only the dim environment.
  expect(material.metalness).toBe(0)
  expect(material.metalnessMap).toBeNull()
  // Its albedo: dark, but not black. 0.08 reads sRGB 15 or more by day in that shade (0.109 read 20, 0.047 read 6.8).
  const value = luminance(await albedo(material, sets))
  expect(value).toBeGreaterThanOrEqual(0.08)
  expect(value).toBeLessThan(0.2)
  // The surface is still textured and still casts and receives shadows.
  expect(material.map).toBeTruthy()
  expect(material.normalMap).toBeTruthy()
  expect(material.roughnessMap).toBeTruthy()
  expect([base.castShadow, base.receiveShadow]).toEqual([true, true])
})
