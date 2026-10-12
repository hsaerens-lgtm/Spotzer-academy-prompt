// @vitest-environment node
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { Color, SRGBColorSpace, Texture, type MeshStandardMaterial } from 'three'
import { TEXTURE_SETS, TEXTURE_SET_IDS } from '../../../three/assets'
import { buildMaterials } from '../../../three/materials'
import type { TextureSets } from '../../../three/textures'
import { textureFile } from '../../../assets/paths'
import { banquetteBoxes } from './plan'

/*
 * The front of the banquette was pure black (0, 0, 0 by day, Task 14 review). The cause was its material, not the light:
 * the base was the shared blackMetal, a metal (no diffuse term) whose reflectance was its tint times a colour map that
 * is already a dark grey (mean sRGB 93): 0.023 * 0.11 = 0.0026, a black body. A beige wall in the same shade reads
 * sRGB 21 there; a surface of albedo 0.0026 reads 0. Measured in the scene by day (face pixels only): tint x map 0.0026
 * -> luma 0, 0.0235 -> 2.4, 0.047 -> 6.8, 0.109 -> 20.
 */

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))

/** The mean colour of a texture set's colour map, as linear RGB (the colour map is sRGB). */
async function meanColour(assetId: string): Promise<Color> {
  const { channels } = await sharp(join(ROOT, 'public/assets', textureFile(assetId, 'color'))).stats()
  return new Color().setRGB(channels[0].mean / 255, channels[1].mean / 255, channels[2].mean / 255, SRGBColorSpace)
}

/** Rec. 709 luminance of a linear colour. */
const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

/** The base colour a material shows before any light: its tint times the mean of its colour map (the tint alone without one). */
async function albedo(material: MeshStandardMaterial, sets: TextureSets): Promise<Color> {
  const owner = TEXTURE_SET_IDS.find((id) => sets[id].color === material.map)
  const base = material.color.clone()
  if (!owner) return base
  return base.multiply(await meanColour(TEXTURE_SETS[owner].assetId))
}

test('the front of the banquette is painted steel that the light can reach, not a black metal', async () => {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
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
