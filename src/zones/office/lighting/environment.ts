import type { Material, Mesh, Object3D, Scene, Texture } from 'three'
import type { StoreApi } from 'zustand/vanilla'
import type { AppState } from '../../../core/store'
import { applyEnvironment } from '../../../three/materials'

/*
 * The environment strength of the scene materials through the day (Task 4 ruling). three 0.186 ignores a material's
 * own envMapIntensity unless the material has its own envMap: with scene.environment alone, every material would take
 * scene.environmentIntensity and lose its ratio (surfaces 1, models 0.8, plants 0.45, glass 1.5). So PhaseDriver hands
 * the collected materials the environment texture the scene holds, at ratio x phase intensity (applyEnvironment), and
 * still writes scene.environmentIntensity for the materials applyEnvironment leaves alone.
 *
 * Materials are collected by a traversal of the scene, not on every frame: again when the environment texture changes,
 * and after requestMaterialRefresh(). refreshOnStageReady() asks for one when the base (sceneReady) or the decor
 * (decorReady, Task 12) becomes ready; content that mounts at any other time calls requestMaterialRefresh() itself.
 */

let refreshes = 0

/** Collects the scene's materials again on the next frame (content with standard materials has just mounted). */
export function requestMaterialRefresh(): void {
  refreshes += 1
}

/** Asks for a refresh whenever the base or the decor stage becomes ready. Returns the function that stops watching. */
export function refreshOnStageReady(store: StoreApi<AppState>): () => void {
  return store.subscribe((state, previous) => {
    if ((state.sceneReady && !previous.sceneReady) || (state.decorReady && !previous.decorReady)) requestMaterialRefresh()
  })
}

/** Every material under `root`, once each (meshes with several materials included). */
function collectMaterials(root: Pick<Object3D, 'traverse'>): Set<Material> {
  const found = new Set<Material>()
  root.traverse((object) => {
    const material = (object as Partial<Mesh>).material
    if (!material) return
    for (const one of Array.isArray(material) ? material : [material]) found.add(one)
  })
  return found
}

/** The part of the scene the applier reads and writes. */
export type EnvironmentScene = Pick<Scene, 'environment' | 'environmentIntensity' | 'traverse'>

/**
 * PhaseDriver's environment step, called on every frame with the phase's environment intensity: writes
 * scene.environmentIntensity, then, once the scene holds an environment texture (drei's <Environment> sets it), hands
 * that very texture and the intensity to every collected material. Never applies a null texture.
 */
export function createEnvironmentApplier(): (scene: EnvironmentScene, intensity: number) => void {
  let materials = new Set<Material>()
  let collectedFor: Texture | null = null
  let collectedAt = -1
  return (scene, intensity) => {
    scene.environmentIntensity = intensity
    const environment = scene.environment
    if (!environment) return
    if (environment !== collectedFor || collectedAt !== refreshes) {
      materials = collectMaterials(scene)
      collectedFor = environment
      collectedAt = refreshes
    }
    // Intensity alone is a uniform: cheap enough on every frame of a transition (needsUpdate only for a new texture).
    applyEnvironment(materials, environment, intensity)
  }
}
