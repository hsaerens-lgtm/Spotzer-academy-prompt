import { extend } from '@react-three/fiber'
import { createElement } from 'react'
import { Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3, type BufferGeometry, type Object3D } from 'three'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { SIZES } from '../../zones/office/footprints'
import { useMaterials } from '../materials'
import { SOFA, Sofa, sofaParts } from './Sofa'

// The shared materials wait for the texture sets: stand-in textures instead (src/test/textureSets.ts).
vi.mock('../materials', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../materials')>()
  const { fakeTextureSets } = await import('../../test/textureSets')
  const built = actual.buildMaterials(fakeTextureSets())
  return { ...actual, useMaterials: () => built }
})

extend({ Group, Mesh })

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

/** Height of the first surface of `geometry` met by a ray going straight down at (x, z). */
function surfaceHeight(geometry: BufferGeometry, x: number, z: number): number {
  const ray = new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0))
  const [hit] = ray.intersectObject(new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide })))
  return hit ? hit.point.y : -Infinity
}

test('the sofa is a low three-seater of its stated size, standing on its legs', () => {
  const { upholstery, pillows, legs } = sofaParts()
  const all = new Box3()
  for (const geometry of [upholstery, pillows, legs]) {
    geometry.computeBoundingBox()
    all.union(geometry.boundingBox!)
  }
  const size = all.getSize(new Vector3())
  expect(size.x).toBeCloseTo(SOFA.width, 3)
  expect(size.y).toBeCloseTo(SOFA.height, 3)
  expect(size.z).toBeCloseTo(SOFA.depth, 3)
  expect(all.min.y).toBeCloseTo(0, 6)
  expect(all.getCenter(new Vector3()).x).toBeCloseTo(0, 6)
  expect(all.getCenter(new Vector3()).z).toBeCloseTo(0, 6)
  legs.computeBoundingBox()
  expect(legs.boundingBox!.min.y).toBeCloseTo(0, 6)
  expect(legs.boundingBox!.max.y).toBeCloseTo(SOFA.legHeight, 6)
  // The layout's footprint is the sofa's.
  expect(SIZES.sofa).toEqual([SOFA.width, SOFA.height, SOFA.depth])
})

test('three separate seat cushions, their tops at seat height', () => {
  const { upholstery } = sofaParts()
  const seams = [-1, 1].map((side) => side * SOFA.cushionPitch / 2)
  expect(SOFA.seats).toBe(3)
  for (let i = 0; i < SOFA.seats; i++) {
    const x = (i - 1) * SOFA.cushionPitch
    expect(surfaceHeight(upholstery, x, 0.15), `seat ${i}`).toBeCloseTo(SOFA.seatTop, 3)
  }
  // Between two cushions the surface drops: they are separate cushions, not one slab.
  for (const x of seams) expect(surfaceHeight(upholstery, x, 0.15)).toBeLessThan(SOFA.seatTop - 0.02)
})

test('the sofa wears its fabric, lime pillows and black legs, and casts and receives shadows', async () => {
  root = await mountR3F(createElement(Sofa, { name: 'sofa' }))
  const m = useMaterials()
  const meshes: Mesh[] = []
  root.state.scene.traverse((object: Object3D) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })
  expect(meshes.map((mesh) => mesh.material)).toEqual([m.sofaFabric, m.cushion, m.blackMetal])
  for (const mesh of meshes) expect(mesh.castShadow && mesh.receiveShadow).toBe(true)
})
