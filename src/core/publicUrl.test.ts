import { publicUrl } from './publicUrl'

test('builds a URL for a file in public/ from the base, never from a leading slash', () => {
  expect(publicUrl('models/sofa.glb', './')).toBe('./models/sofa.glb')
  expect(publicUrl('models/sofa.glb', '/academy/')).toBe('/academy/models/sofa.glb')
  expect(publicUrl('models/sofa.glb', '/')).toBe('/models/sofa.glb')
})

test('tolerates a base without a trailing slash and a path with a leading slash', () => {
  expect(publicUrl('/models/sofa.glb', '/academy')).toBe('/academy/models/sofa.glb')
  expect(publicUrl('models/sofa.glb', '')).toBe('./models/sofa.glb')
})

test('uses the build base by default', () => {
  expect(publicUrl('models/sofa.glb')).toBe(`${import.meta.env.BASE_URL.replace(/\/?$/, '/')}models/sofa.glb`)
})
