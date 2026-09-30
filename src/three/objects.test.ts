import { resolveObject } from './objects'

test('objects are procedural unless a GLB is declared', () => {
  expect(resolveObject('sofa')).toEqual({ kind: 'procedural' })
  expect(resolveObject('sofa', { sofa: '/models/sofa.glb' })).toEqual({ kind: 'glb', url: '/models/sofa.glb' })
})
