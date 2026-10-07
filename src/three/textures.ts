import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { TEXTURE_MAPS, type TextureMap } from '../assets/paths'
import { TEXTURE_SET_IDS, TEXTURE_SETS, textureUrl, type TextureSetId } from './assets'

/** Sharp floors and walls at grazing angles, without paying for 16x on an integrated GPU. */
export const MAX_ANISOTROPY = 8

/** One PBR texture set: colour (sRGB), normal (OpenGL convention) and ARM (R ambient occlusion, G roughness, B metalness). */
export interface PbrTextures {
  color: Texture
  normal: Texture
  arm: Texture
}
export type TextureSets = Record<TextureSetId, PbrTextures>

/** Every texture file of the room, in a fixed order: for each set of TEXTURE_SET_IDS, its colour, normal and ARM maps. */
export function textureSetUrls(): string[] {
  return TEXTURE_SET_IDS.flatMap((id) => TEXTURE_MAPS.map((map) => textureUrl(id, map)))
}

/**
 * The one place where a loaded texture is set up: colour space (only colour maps are sRGB), repeat in metres
 * (geometry UVs are in metres, so one repeat covers `tileMetres`) and anisotropy. Idempotent: a texture shared by
 * several materials is configured once, and later calls change nothing.
 */
export function configureTexture(texture: Texture, map: TextureMap, tileMetres: number, anisotropy: number): Texture {
  if (texture.userData.configured) return texture
  texture.colorSpace = map === 'color' ? SRGBColorSpace : NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1 / tileMetres, 1 / tileMetres)
  texture.anisotropy = anisotropy
  texture.userData.configured = true
  texture.needsUpdate = true
  return texture
}

/*
 * Lifetime: the texture sets live as long as the page and are never disposed, like the shared materials built on them
 * (the office is mounted once). Nothing here releases a texture, and nothing should.
 */

/** TextureSets per loaded texture array: every component gets the same object (the material cache relies on it). */
const sets = new WeakMap<Texture[], TextureSets>()

/** All PBR texture sets of the room: one suspension for every file, then configured once. Use inside the Canvas. */
export function useTextureSets(): TextureSets {
  const gl = useThree((state) => state.gl)
  const textures = useTexture(textureSetUrls())
  const cached = sets.get(textures)
  if (cached) return cached
  const anisotropy = Math.min(MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy())
  const built = {} as TextureSets
  TEXTURE_SET_IDS.forEach((id, index) => {
    const { tileMetres } = TEXTURE_SETS[id]
    const [color, normal, arm] = TEXTURE_MAPS.map((map, k) =>
      configureTexture(textures[index * TEXTURE_MAPS.length + k], map, tileMetres, anisotropy),
    )
    built[id] = { color, normal, arm }
  })
  sets.set(textures, built)
  return built
}
