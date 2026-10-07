import { BoxGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Scene, Texture, type Material } from 'three'
import { createAppStore } from '../../../core/store'
import { memoryStorage } from '../../../test/memoryStorage'
import { ENV_MAP_INTENSITY } from '../../../three/materials'
import { createEnvironmentApplier, refreshOnStageReady, requestMaterialRefresh } from './environment'

/*
 * The environment contract (Task 4 ruling): three 0.186 ignores a material's own envMapIntensity unless the material
 * has its own envMap, so PhaseDriver hands every scene material the scene's environment texture itself, with the
 * phase intensity scaled by the material's ratio, and keeps writing scene.environmentIntensity for the others.
 */

function add(scene: Scene, material: Material | Material[]): void {
  scene.add(new Mesh(new BoxGeometry(), material))
}

function office() {
  const scene = new Scene()
  const surface = new MeshStandardMaterial({ envMapIntensity: ENV_MAP_INTENSITY.surface })
  const plant = new MeshStandardMaterial({ envMapIntensity: ENV_MAP_INTENSITY.plant })
  const glass = new MeshPhysicalMaterial({ envMapIntensity: 1.5 })
  const flat = new MeshBasicMaterial()
  add(scene, surface)
  add(scene, [plant, glass]) // a mesh with several materials
  add(scene, flat)
  return { scene, surface, plant, glass, flat }
}

test('every material gets the scene environment at its ratio of the phase intensity', () => {
  const { scene, surface, plant, glass, flat } = office()
  const apply = createEnvironmentApplier()
  // Before drei has captured the environment: only the scene strength is written, no material is touched.
  apply(scene, 0.32)
  expect(scene.environmentIntensity).toBe(0.32)
  for (const material of [surface, plant, glass]) {
    expect(material.envMap, material.type).toBeNull()
    expect(material.version, material.type).toBe(0)
    expect(material.userData.envBase, material.type).toBeUndefined()
  }
  const environment = new Texture()
  scene.environment = environment
  apply(scene, 0.32)
  // The very texture the scene holds, not a copy.
  for (const material of [surface, plant, glass]) expect(material.envMap, material.type).toBe(environment)
  expect(surface.envMapIntensity).toBeCloseTo(0.32)
  expect(plant.envMapIntensity).toBeCloseTo(0.45 * 0.32)
  expect(glass.envMapIntensity).toBeCloseTo(1.5 * 0.32)
  expect(scene.environmentIntensity).toBe(0.32)
  expect((flat as { envMap?: unknown }).envMap ?? null).toBeNull()
  // A transition frame: the strength follows, no shader is rebuilt.
  const versions = [surface, plant, glass].map((material) => material.version)
  apply(scene, 0.25)
  expect(scene.environmentIntensity).toBe(0.25)
  expect(plant.envMapIntensity).toBeCloseTo(0.45 * 0.25)
  expect(glass.envMapIntensity).toBeCloseTo(1.5 * 0.25)
  expect([surface, plant, glass].map((material) => material.version)).toEqual(versions)
})

test('materials are collected again when the environment changes or a refresh is asked', () => {
  const { scene, surface } = office()
  const apply = createEnvironmentApplier()
  const first = new Texture()
  scene.environment = first
  apply(scene, 0.32)
  // Content mounted later is not seen until a refresh: no scene traversal on every frame.
  const late = new MeshStandardMaterial({ envMapIntensity: ENV_MAP_INTENSITY.model })
  add(scene, late)
  apply(scene, 0.32)
  expect(late.envMap).toBeNull()
  requestMaterialRefresh()
  apply(scene, 0.18)
  expect(late.envMap).toBe(first)
  expect(late.envMapIntensity).toBeCloseTo(0.8 * 0.18)
  // A new environment texture (drei captured again): every material, old and new, takes it.
  const later = new MeshStandardMaterial()
  add(scene, later)
  const second = new Texture()
  scene.environment = second
  apply(scene, 0.05)
  for (const material of [surface, late, later]) expect(material.envMap).toBe(second)
  expect(late.envMapIntensity).toBeCloseTo(0.8 * 0.05)
})

test('the base and the decor becoming ready ask for a refresh', () => {
  const store = createAppStore({ getTopic: () => undefined, storage: memoryStorage() })
  const stop = refreshOnStageReady(store)
  const { scene } = office()
  const apply = createEnvironmentApplier()
  const environment = new Texture()
  scene.environment = environment
  apply(scene, 0.32)
  const base = new MeshStandardMaterial()
  add(scene, base)
  store.getState().setSceneReady(true)
  apply(scene, 0.32)
  expect(base.envMap).toBe(environment)
  const decor = new MeshStandardMaterial()
  add(scene, decor)
  store.getState().setDecorReady(true)
  apply(scene, 0.32)
  expect(decor.envMap).toBe(environment)
  // Other changes of the state ask for nothing, nor does a stopped watch.
  const idle = new MeshStandardMaterial()
  add(scene, idle)
  store.getState().setHovered('laptop')
  store.getState().setDecorReady(true)
  apply(scene, 0.32)
  expect(idle.envMap).toBeNull()
  stop()
  store.getState().setDecorReady(false)
  store.getState().setDecorReady(true)
  apply(scene, 0.32)
  expect(idle.envMap).toBeNull()
})
