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

test('declared models live under assets/models', () => {
  const catalogue = (Object.keys(MODELS) as ModelId[]).map(modelUrl)
  for (const [name, url] of Object.entries(glbModels)) {
    expect(url, name).toMatch(/assets\/models\/[a-z0-9_]+\.glb$/)
    expect(url!.startsWith(publicUrl('assets/models/')), name).toBe(true)
    expect(catalogue, name).toContain(url)
  }
})
