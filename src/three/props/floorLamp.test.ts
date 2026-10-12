import { extend } from '@react-three/fiber'
import { Fragment, createElement, type ReactElement } from 'react'
import { Box3, Group, Mesh, Vector3, type BufferGeometry, type Material, type Object3D } from 'three'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { SIZES } from '../../zones/office/footprints'
import { layout } from '../../zones/office/layout'
import { untexturedMeshes } from '../audit'
import { useMaterials } from '../materials'
import { FLOOR_LAMP, FloorLamp } from './FloorLamp'

// The shared materials wait for the texture sets: stand-in textures instead (src/test/textureSets.ts).
vi.mock('../materials', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../materials')>()
  const { fakeTextureSets } = await import('../../test/textureSets')
  const built = actual.buildMaterials(fakeTextureSets())
  return { ...actual, useMaterials: () => built }
})

// The JSX elements the lamp mounts (<Canvas> registers all of three in the app).
extend({ Group, Mesh })

beforeAll(() => {
  ignoreClockDeprecation()
})
afterAll(() => {
  vi.restoreAllMocks()
})

const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
})

/** Mounts `elements` in an R3F root with a stand-in renderer (src/test/r3fRoot.tsx) and returns its scene. */
async function mount(...elements: ReactElement[]): Promise<Object3D> {
  const root = await mountR3F(createElement(Fragment, null, ...elements))
  roots.push(root)
  root.state.scene.updateMatrixWorld(true)
  return root.state.scene
}

function named(scene: Object3D, name: string): Object3D {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object
}

function meshesOf(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })
  return meshes
}

const isEmissive = (material: Material) => material.userData.auditExempt === 'emissive'

/** Vertices whose UV is not a pair of their own coordinates in metres (box projection: u is x or z, v is y or z). */
function nonMetreUVs(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-5
  let wrong = 0
  for (let i = 0; i < uv.count; i++) {
    const [x, y, z, u, v] = [position.getX(i), position.getY(i), position.getZ(i), uv.getX(i), uv.getY(i)]
    if (!(near(u, x) || near(u, z)) || !(near(v, y) || near(v, z))) wrong++
  }
  return wrong
}

test('the floor lamp fills its footprint and stands FLOOR_LAMP.top high', async () => {
  const lamp = named(await mount(createElement(FloorLamp, { name: 'floorLamp' })), 'floorLamp')
  const box = new Box3().setFromObject(lamp)
  const size = box.getSize(new Vector3()).toArray()
  SIZES.floorLamp.forEach((expected, k) => expect(Math.abs(size[k] - expected), `axis ${k}`).toBeLessThanOrEqual(0.001))
  // Standing on the floor, centred on its position, its parts stacked from the foot to the top of the shade.
  expect(box.min.y).toBeCloseTo(0, 3)
  expect(box.max.y - box.min.y).toBeCloseTo(FLOOR_LAMP.top, 3)
  expect(box.min.x + box.max.x).toBeCloseTo(0, 3)
  expect(box.min.z + box.max.z).toBeCloseTo(0, 3)
  expect(FLOOR_LAMP.footHeight + FLOOR_LAMP.stemHeight + FLOOR_LAMP.shadeHeight).toBeCloseTo(FLOOR_LAMP.top, 6)
  expect(FLOOR_LAMP.top).toBeCloseTo(1.55, 2)
})

// Task 9 and 10 ruling R1: every mesh that is neither glass nor emissive casts and receives shadows.
test('the foot and the stem cast and receive shadows; the glowing shade casts none', async () => {
  const lamp = named(await mount(createElement(FloorLamp, { name: 'floorLamp' })), 'floorLamp')
  const meshes = meshesOf(lamp)
  const shades = meshes.filter((mesh) => isEmissive(mesh.material as Material))
  const solid = meshes.filter((mesh) => !isEmissive(mesh.material as Material))
  expect(shades).toHaveLength(1)
  expect(solid.length).toBeGreaterThanOrEqual(2)
  for (const mesh of solid) {
    expect(mesh.castShadow, (mesh.material as Material).name).toBe(true)
    expect(mesh.receiveShadow, (mesh.material as Material).name).toBe(true)
  }
  // The shade is the shared lampShade, which lights up with the phase (lighting/emissive.ts), like the sideboard globe.
  expect(shades[0].material).toBe(useMaterials().lampShade)
  expect(shades[0].castShadow).toBe(false)
})

test('the floor lamp passes the material audit, with metre UVs and geometries shared by every copy', async () => {
  const scene = await mount(createElement(FloorLamp, { key: 'a', name: 'a' }), createElement(FloorLamp, { key: 'b', name: 'b', position: [1, 0, 0] }))
  const [a, b] = [meshesOf(named(scene, 'a')), meshesOf(named(scene, 'b'))]
  expect(untexturedMeshes(named(scene, 'a'))).toEqual([])
  for (const mesh of a) {
    const material = mesh.material as Material & { map?: unknown; normalMap?: unknown }
    if (material.map || material.normalMap) expect(nonMetreUVs(mesh.geometry), material.name).toBe(0)
  }
  expect(b.map((mesh) => mesh.geometry)).toEqual(a.map((mesh) => mesh.geometry))
  b.forEach((mesh, i) => expect(mesh.geometry).toBe(a[i].geometry))
})

test('the light of the floor lamp shines from the centre of its shade', () => {
  const [x, y, z] = layout.objects.floorLamp.position
  const light = layout.lights.floorLamp.position
  expect(light[0]).toBeCloseTo(x)
  expect(light[1]).toBeCloseTo(y + FLOOR_LAMP.top - FLOOR_LAMP.shadeHeight / 2)
  expect(light[2]).toBeCloseTo(z)
})
