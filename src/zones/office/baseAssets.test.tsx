import { useGLTF, useTexture } from '@react-three/drei'
import { Group } from 'three'
import { mountR3F, type TestRoot } from '../../test/r3fRoot'
import { MODELS, modelUrl, type ModelId } from '../../three/assets'
import { glbModels, resolveObject } from '../../three/objects'
import { textureSetUrls } from '../../three/textures'
import { baseModelUrls, preloadBaseAssets, useBaseModels } from './baseAssets'
import { areaLightTablesReady } from './lighting/areaLights'

/*
 * Every download of the base stage starts at once when the 3D stage mounts (Task 16b). Before, the base suspended on
 * one asset at a time: the textures, then the area light tables, then each of the three models, every retry rendering
 * the whole office again. Never at module level: reading mode loads no 3D asset (spec section 8).
 */

vi.mock('@react-three/drei', async (importOriginal) => {
  const drei = await importOriginal<typeof import('@react-three/drei')>()
  return {
    ...drei,
    useTexture: Object.assign(vi.fn(), { preload: vi.fn() }),
    useGLTF: Object.assign(vi.fn(), { preload: vi.fn() }),
  }
})
vi.mock('./lighting/areaLights', () => ({ areaLightTablesReady: vi.fn(() => Promise.resolve()), areaLightTablesBuilt: () => false }))

const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  vi.clearAllMocks()
})

test('the base preloads every texture set in one request, as useTextureSets reads them', () => {
  preloadBaseAssets()
  expect(useTexture.preload).toHaveBeenCalledTimes(1)
  // The same list, in the same order: the loader cache key of useTexture(textureSetUrls()).
  expect(useTexture.preload).toHaveBeenCalledWith(textureSetUrls())
})

test('the base preloads its models as useGLTF loads them, and no decor model', () => {
  preloadBaseAssets()
  const base = (Object.keys(MODELS) as ModelId[]).filter((id) => MODELS[id].stage === 'base').map(modelUrl)
  expect(base).toHaveLength(4)
  expect(baseModelUrls()).toEqual(base)
  expect(vi.mocked(useGLTF.preload).mock.calls).toEqual(base.map((url) => [url, false, true]))
})

test('the base models are the models the base draws its sideboard, TV, clock and laptop with', () => {
  // The other objects of the base are procedural (the sofa included: the default glbModels keep it so).
  expect(baseModelUrls()).toEqual([glbModels.sideboard, glbModels.crtTv, glbModels.clock, glbModels.laptop])
  expect(resolveObject('sofa')).toEqual({ kind: 'procedural' })
})

test('the base preloads the area light tables, and leaves a failure there to the rig', async () => {
  const unhandled = vi.fn()
  process.on('unhandledRejection', unhandled)
  vi.mocked(areaLightTablesReady).mockReturnValueOnce(Promise.reject(new Error('chunk failed')))
  preloadBaseAssets()
  expect(areaLightTablesReady).toHaveBeenCalledTimes(1)
  // Caught here: Lights asks again when it mounts, and its Suspense boundary reports the error.
  await new Promise((resolve) => setTimeout(resolve, 0))
  process.off('unhandledRejection', unhandled)
  expect(unhandled).not.toHaveBeenCalled()
})

test('importing the office and its stage starts no download', async () => {
  vi.resetModules()
  const drei = await import('@react-three/drei')
  const areaLights = await import('./lighting/areaLights')
  await import('./OfficeScene')
  await import('../../app/Stage')
  expect(drei.useTexture.preload).not.toHaveBeenCalled()
  expect(drei.useGLTF.preload).not.toHaveBeenCalled()
  expect(areaLights.areaLightTablesReady).not.toHaveBeenCalled()
})

// The scene reads its three models at its top: it suspends once, before rendering the room, instead of after it (the
// models come last in the tree), so the models parse on a free main thread and the fallback shows as early as it can.
test('useBaseModels reads every base model as GltfObject does', async () => {
  vi.mocked(useGLTF).mockImplementation(() => ({ scene: new Group() }) as never)
  function Reader() {
    useBaseModels()
    return null
  }
  roots.push(await mountR3F(<Reader />))
  expect(vi.mocked(useGLTF).mock.calls).toEqual(baseModelUrls().map((url) => [url, false, true]))
})

// A model that cannot load fails where it is drawn, inside its own boundary (the laptop's stand-in), not at the top.
test('useBaseModels leaves a model that failed to load to the object that draws it', async () => {
  vi.mocked(useGLTF).mockImplementation(((url: string) => {
    if (url === glbModels.laptop) throw new Error('Could not load classic_laptop.glb: 404')
    return { scene: new Group() }
  }) as never)
  let rendered = false
  function Reader() {
    useBaseModels()
    rendered = true
    return null
  }
  roots.push(await mountR3F(<Reader />))
  expect(rendered).toBe(true)
})
