import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { Color, SRGBColorSpace, Texture, type MeshStandardMaterial } from 'three'
import { textureFile } from '../assets/paths'
import { TEXTURE_SETS, TEXTURE_SET_IDS } from '../three/assets'
import type { TextureSets } from '../three/textures'

/*
 * The base colour a material shows before any light, for the node tests that read the real texture files: its tint
 * times the mean of its colour map, in linear RGB. Uses sharp: only for files that start with `// @vitest-environment node`.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** The mean colour of a texture set's colour map, as linear RGB (the colour map is sRGB). */
export async function meanColour(assetId: string): Promise<Color> {
  const { channels } = await sharp(join(ROOT, 'public/assets', textureFile(assetId, 'color'))).stats()
  return new Color().setRGB(channels[0].mean / 255, channels[1].mean / 255, channels[2].mean / 255, SRGBColorSpace)
}

/** Rec. 709 luminance of a linear colour. */
export const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

/** A material's tint times the mean of its colour map (the tint alone without one); `sets` says which set the map is. */
export async function albedo(material: MeshStandardMaterial, sets: TextureSets): Promise<Color> {
  const owner = TEXTURE_SET_IDS.find((id) => sets[id].color === material.map)
  const base = material.color.clone()
  if (!owner) return base
  return base.multiply(await meanColour(TEXTURE_SETS[owner].assetId))
}

/** Texture sets of unloaded textures, one distinct Texture per map, for building the shared materials in a node test. */
export function fakeTextureSets(): TextureSets {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
  return sets
}
