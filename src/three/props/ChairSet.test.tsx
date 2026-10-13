import { extend } from '@react-three/fiber'
import { createElement } from 'react'
import { Group, InstancedBufferAttribute, InstancedMesh, type Object3D } from 'three'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { layout } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { ChairSet } from './ChairSet'
import { chairParts } from './chairParts'

// The shared materials wait for the texture sets: stand-in textures instead (src/test/textureSets.ts).
vi.mock('../materials', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../materials')>()
  const { fakeTextureSets } = await import('../../test/textureSets')
  const built = actual.buildMaterials(fakeTextureSets())
  return { ...actual, useMaterials: () => built }
})

extend({ Group, InstancedBufferAttribute, InstancedMesh })

beforeAll(() => {
  ignoreClockDeprecation()
})
afterAll(() => {
  vi.restoreAllMocks()
})

let root: TestRoot | null = null
afterEach(async () => {
  await root?.unmount()
  root = null
})

function instancedMeshes(scene: Object3D): InstancedMesh[] {
  const found: InstancedMesh[] = []
  scene.traverse((object) => {
    if ((object as InstancedMesh).isInstancedMesh) found.push(object as InstancedMesh)
  })
  return found
}

test('the chairs are three instanced parts, one instance per chair, casting and receiving shadows', async () => {
  const placements = layout.objects.chairs
  root = await mountR3F(createElement(ChairSet, { placements }))
  await root.frame()
  const m = useMaterials()
  const { fabric, frame, chrome } = chairParts()
  const meshes = instancedMeshes(root.state.scene)
  expect(meshes.map((mesh) => [mesh.geometry, mesh.material])).toEqual([
    [fabric, m.chairFabric],
    [frame, m.blackMetal],
    [chrome, m.brushedMetal],
  ])
  for (const mesh of meshes) {
    expect(mesh.count).toBe(placements.length)
    expect(mesh.castShadow && mesh.receiveShadow).toBe(true)
  }
  for (let i = 0; i < placements.length; i++) expect(root.state.scene.getObjectByName(`chair-${i}`), `chair-${i}`).toBeDefined()
})
