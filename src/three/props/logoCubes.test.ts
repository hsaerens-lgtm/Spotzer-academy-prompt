import { extend } from '@react-three/fiber'
import { createElement } from 'react'
import { Box3, BoxGeometry, Group, Mesh, type Object3D } from 'three'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { sceneBoxes } from '../../zones/office/footprints'
import { ROOM, layout } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { LogoCubes } from './LogoCubes'

/*
 * The Athena sign as it stands in the office: the real LogoCubes, at its layout placement, against the footprint the
 * layout tests use (sceneBoxes), and against the back wall it hangs on (Task 10b: 5 mm off the wall, not floating).
 */

// The shared materials wait for the texture sets: stand-in textures instead (src/test/textureSets.ts).
vi.mock('../materials', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../materials')>()
  const { fakeTextureSets } = await import('../../test/textureSets')
  const built = actual.buildMaterials(fakeTextureSets())
  return { ...actual, useMaterials: () => built }
})

// The JSX elements the sign mounts (<Canvas> registers all of three in the app).
extend({ BoxGeometry, Group, Mesh })

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

/** The sign at its place in the office, in an R3F root with a stand-in renderer (src/test/r3fRoot.tsx). */
async function mountSign(): Promise<Object3D> {
  const { position, rotationY = 0 } = layout.objects.logo
  const root = await mountR3F(createElement(LogoCubes, { name: 'logo', position, rotation: [0, rotationY, 0] }))
  roots.push(root)
  root.state.scene.updateMatrixWorld(true)
  const sign = root.state.scene.getObjectByName('logo')
  if (!sign) throw new Error('no sign')
  return sign
}

test('the sign fills the logo footprint of sceneBoxes, within 1 mm on every side', async () => {
  const sign = new Box3().setFromObject(await mountSign())
  const footprint = sceneBoxes().find((box) => box.name === 'logo')!
  for (let k = 0; k < 3; k++) {
    expect(Math.abs(sign.min.getComponent(k) - footprint.min[k]), `min, axis ${k}`).toBeLessThanOrEqual(0.001)
    expect(Math.abs(sign.max.getComponent(k) - footprint.max[k]), `max, axis ${k}`).toBeLessThanOrEqual(0.001)
  }
})

test('the back of the plate hangs 1 to 10 mm off the back wall', async () => {
  const sign = await mountSign()
  const plates = sign.children.filter((child) => (child as Mesh).material === useMaterials().signBack)
  expect(plates).toHaveLength(1)
  const gap = new Box3().setFromObject(plates[0]).min.z - ROOM.z0
  expect(gap).toBeGreaterThanOrEqual(0.001)
  expect(gap).toBeLessThanOrEqual(0.01)
  // Nothing of the sign goes into the wall.
  expect(new Box3().setFromObject(sign).min.z).toBeGreaterThan(ROOM.z0)
})
