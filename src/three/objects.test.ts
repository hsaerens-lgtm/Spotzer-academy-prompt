import { publicUrl } from '../core/publicUrl'
import { MODELS, modelUrl, type ModelId } from './assets'
import { OBJECT_NAMES, glbModels, hasSource, resolveObject, type ObjectName } from './objects'

test('objects are procedural unless a GLB is declared', () => {
  expect(resolveObject('sofa')).toEqual({ kind: 'procedural' })
  expect(resolveObject('sofa', { sofa: 'models/sofa.glb' })).toEqual({ kind: 'glb', url: 'models/sofa.glb' })
})

test('every object name has a source', () => {
  // Compile-time: OBJECT_NAMES lists exactly the ObjectName union (npm run typecheck fails otherwise).
  expectTypeOf<(typeof OBJECT_NAMES)[number]>().toEqualTypeOf<ObjectName>()
  expect(new Set(OBJECT_NAMES).size).toBe(OBJECT_NAMES.length)
  for (const name of OBJECT_NAMES) expect(hasSource(name), name).toBe(true)
  expect(hasSource('sofa', {})).toBe(true)
})

test('the floor lamp of the lounge corner is drawn in code', () => {
  expect(OBJECT_NAMES).toContain('floorLamp')
  expect(resolveObject('floorLamp')).toEqual({ kind: 'procedural' })
  expect(hasSource('floorLamp', {})).toBe(true)
})

test('declared models live under assets/models', () => {
  const catalogue = (Object.keys(MODELS) as ModelId[]).map(modelUrl)
  for (const [name, url] of Object.entries(glbModels)) {
    expect(url, name).toMatch(/assets\/models\/[a-z0-9_]+\.glb$/)
    expect(url!.startsWith(publicUrl('assets/models/')), name).toBe(true)
    expect(catalogue, name).toContain(url)
  }
})

test('the sideboard, the TV and the wall clock are drawn by their CC0 models', () => {
  expect(resolveObject('sideboard')).toEqual({ kind: 'glb', url: modelUrl('sideboard') })
  expect(resolveObject('crtTv')).toEqual({ kind: 'glb', url: modelUrl('television') })
  expect(resolveObject('clock')).toEqual({ kind: 'glb', url: modelUrl('wallClock') })
  expect([glbModels.sideboard, glbModels.crtTv, glbModels.clock]).toEqual(
    ['modern_wooden_cabinet', 'television_02', 'wall_clock'].map((id) => publicUrl(`assets/models/${id}.glb`)),
  )
  // Nothing else draws the clock: without its model it has no source.
  expect(hasSource('clock', {})).toBe(false)
})

// Task 12: the decor stage's four models (each in its own AssetBoundary).
test('the drawer cabinet, the coffee table, the pendants and the picture frames are drawn by their CC0 models', () => {
  const decor = { cabinet: 'drawer_cabinet', coffeeTable: 'modern_coffee_table_01', pendant: 'modern_ceiling_lamp_01', pictureFrame: 'hanging_picture_frame_01' }
  for (const [name, assetId] of Object.entries(decor) as [ObjectName, string][]) {
    expect(OBJECT_NAMES, name).toContain(name)
    expect(resolveObject(name), name).toEqual({ kind: 'glb', url: publicUrl(`assets/models/${assetId}.glb`) })
    // Nothing else draws them: without its model, an item has no source (AssetBoundary leaves it out).
    expect(hasSource(name, {}), name).toBe(false)
  }
  // Four base models, these four, and the five of Task 14: the final registry.
  expect(Object.keys(glbModels)).toHaveLength(13)
})

// The laptop on the meeting table is the CC0 retro laptop; its procedural version stays as the fallback (LaptopModel).
test('the laptop is drawn by the retro laptop model, the procedural one kept as a fallback', () => {
  expect(resolveObject('laptop')).toEqual({ kind: 'glb', url: publicUrl('assets/models/classic_laptop.glb') })
  expect(hasSource('laptop', {})).toBe(true)
})

// Task 14: the large plants, the vases and the clay planter (decor.test.ts checks their registry entries and stage).
test('the large plants, the vases and the clay planter have no procedural fallback', () => {
  const plants = { pottedPlant: 'potted_plant_01', pachira: 'pachira_aquatica_01', vaseTall: 'ceramic_vase_01', vaseRound: 'ceramic_vase_04', clayPot: 'planter_pot_clay' }
  for (const [name, assetId] of Object.entries(plants) as [ObjectName, string][]) {
    expect(glbModels[name], name).toBe(publicUrl(`assets/models/${assetId}.glb`))
    expect(hasSource(name, {}), name).toBe(false)
  }
})
