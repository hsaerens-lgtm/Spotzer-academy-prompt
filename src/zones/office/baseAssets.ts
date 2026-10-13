import { useGLTF, useTexture } from '@react-three/drei'
import { MODELS, modelUrl, type ModelId } from '../../three/assets'
import { textureSetUrls } from '../../three/textures'
import { areaLightTablesReady } from './lighting/areaLights'

/** The models the base stage draws (MODELS of stage 'base': the sideboard, the TV and the clock), by URL. */
export function baseModelUrls(): string[] {
  return (Object.keys(MODELS) as ModelId[]).filter((id) => MODELS[id].stage === 'base').map(modelUrl)
}

/**
 * Starts every download of the base stage at once: the texture sets, the base models and the area light tables.
 * Without it the base suspends on one asset at a time (the textures, then the tables, then each model), and every
 * retry renders the whole office again: on the reference PC the last base model arrived 0.45 s after the textures
 * (Task 16b). The keys are the ones the scene reads with (useTextureSets, useGLTF(url, false, true)), so the scene
 * finds everything in the loaders' cache, usually before its first render.
 * Called when the 3D stage mounts, never at module level: reading mode loads no 3D asset (spec section 8).
 */
export function preloadBaseAssets(): void {
  useTexture.preload(textureSetUrls())
  for (const url of baseModelUrls()) useGLTF.preload(url, false, true)
  // A failure is reported by the rig, which asks again when it mounts (Lights.tsx).
  areaLightTablesReady().catch(() => {})
}

/**
 * Reads the base models as GltfObject does, for the top of the scene: if one is still parsing, the scene suspends there,
 * before rendering the room, and not after it (the models come last in the tree). The models then parse on a free main
 * thread, and the room renders once, when they are in (Task 16b).
 * A model that failed to load is left to the object that draws it: its error comes again there, inside its own
 * boundary (the laptop falls back to its procedural version), instead of taking the whole scene down here.
 */
export function useBaseModels(): void {
  for (const url of baseModelUrls()) {
    try {
      useGLTF(url, false, true)
    } catch (thrown) {
      // A pending load suspends as before; only a settled failure is let through.
      if (thrown instanceof Promise) throw thrown
    }
  }
}
