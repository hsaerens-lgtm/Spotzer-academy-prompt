import { Texture } from 'three'
import { TEXTURE_SET_IDS } from '../three/assets'
import type { TextureSets } from '../three/textures'

/**
 * Texture sets of unloaded textures, one distinct Texture per map: what buildMaterials() needs to build the shared
 * materials in a test, without a file or a GPU. Distinct maps let a test tell which set a material uses.
 */
export function fakeTextureSets(): TextureSets {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
  return sets
}
