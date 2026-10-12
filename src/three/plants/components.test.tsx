import { extend } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { Group, Mesh, type Material, type Object3D } from 'three'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { Books } from '../Books'
import { HANGING_SWAY, HangingPlant } from './HangingPlant'
import { Plant } from './Plant'
import { plantMaterials } from './plantMaterials'
import { swayRotation } from './sway'
import type { HangingPlacement, PlantPlacement, ShelfBooksSpec } from './types'

/*
 * The three generated-object components, mounted in a stand-in R3F root: what they put in the scene (meshes, shared
 * materials), the shadow rule (everything that is not glass or emissive casts and receives), the sway that follows
 * `animate`, and the books' geometry released on unmount. No scene here: Task 14 mounts them in the decor.
 */

// The book atlas is painted on a canvas, which jsdom does not have: the books get a plain material here.
vi.mock('../shelfBooks', async (importOriginal) => {
  const original = await importOriginal<typeof import('../shelfBooks')>()
  const { MeshStandardMaterial } = await import('three')
  const material = new MeshStandardMaterial({ name: 'books' })
  return { ...original, booksMaterial: () => material }
})

// The JSX elements the components mount (<Canvas> registers all of three in the app).
extend({ Group, Mesh })

const plant: PlantPlacement = { kind: 'herb', position: [1, 2, 3], pot: 'cream', r: 0.1, h: 0.12, scale: 1, seed: 11, sway: 0.03 }
const hanging: HangingPlacement = { position: [0, 2.5, 0], seed: 5, glaze: 'sage', vines: 4, length: 0.6, drop: 0.5 }
const shelf: ShelfBooksSpec = { x0: 3.3, x1: 4.6, y: 1.325, z: -5.87, seed: 61 }

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) throw new Error(`unexpected warning: ${String(args[0])}`)
  })
})
const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  vi.restoreAllMocks()
})
async function mount(element: ReactNode) {
  const root = await mountR3F(element)
  roots.push(root)
  return root
}

function meshes(root: TestRoot): Mesh[] {
  const found: Mesh[] = []
  root.state.scene.traverse((object: Object3D) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh)
  })
  return found
}

test('a plant is a pot and a canopy, each casting and receiving shadows', async () => {
  const root = await mount(<Plant placement={plant} animate={false} name="herb" />)
  const [pot, canopy] = meshes(root)
  expect(meshes(root)).toHaveLength(2)
  expect(root.state.scene.getObjectByName('herb')?.position.toArray()).toEqual([1, 2, 3])
  expect(pot.material).toBe(plantMaterials().pots.cream)
  expect(canopy.material).toBe(plantMaterials().canopy)
  for (const mesh of [pot, canopy]) expect([mesh.castShadow, mesh.receiveShadow]).toEqual([true, true])
  // A plant standing in a vase has no pot of its own.
  const potless = await mount(<Plant placement={{ ...plant, pot: 'none' }} animate={false} />)
  expect(meshes(potless)).toHaveLength(1)
  expect(meshes(potless)[0].material).toBe(plantMaterials().canopy)
})

test('a plant sways only when it is animated and asks for it', async () => {
  const root = await mount(<Plant placement={plant} animate />)
  const sway = meshes(root)[1].parent!
  await root.frame()
  await root.frame()
  const expected = swayRotation(root.state.clock.elapsedTime, plant.sway, plant.seed)
  expect(Math.abs(expected.z)).toBeGreaterThan(0.01)
  expect(sway.rotation.z).toBeCloseTo(expected.z, 9)
  expect(sway.rotation.x).toBeCloseTo(expected.x, 9)
  // Reduced motion or a low quality tier: it stands straight again.
  await root.render(<Plant placement={plant} animate={false} />)
  await root.frame()
  expect([sway.rotation.x, sway.rotation.z]).toEqual([0, 0])
  // A placement without sway never moves, animated or not.
  await root.render(<Plant placement={{ ...plant, sway: 0 }} animate />)
  await root.frame()
  expect([sway.rotation.x, sway.rotation.z]).toEqual([0, 0])
})

// The low tier, reduced motion and sway-free placements: a frame costs nothing once the plant stands straight.
test('a plant at rest leaves its rotation alone from frame to frame', async () => {
  const root = await mount(<Plant placement={plant} animate={false} />)
  const sway = meshes(root)[1].parent!
  await root.frame()
  const rotate = vi.spyOn(sway.quaternion, 'setFromEuler')
  await root.frame()
  await root.frame()
  expect(rotate).not.toHaveBeenCalled()
  expect([sway.rotation.x, sway.rotation.z]).toEqual([0, 0])
  // Swaying, it turns once per frame: both angles at once.
  await root.render(<Plant placement={plant} animate />)
  rotate.mockClear()
  await root.frame()
  expect(rotate).toHaveBeenCalledOnce()
})

test('a hanging plant is cords, pot and canopy, swinging about its hook', async () => {
  const root = await mount(<HangingPlant placement={hanging} animate name="hanging" />)
  const [cords, pot, canopy] = meshes(root)
  expect(meshes(root)).toHaveLength(3)
  expect(root.state.scene.getObjectByName('hanging')?.position.toArray()).toEqual([0, 2.5, 0])
  expect(cords.material).toBe(plantMaterials().cord)
  expect(pot.material).toBe(plantMaterials().hangingPots.sage)
  expect(canopy.material).toBe(plantMaterials().canopy)
  for (const mesh of [cords, pot, canopy]) expect([mesh.castShadow, mesh.receiveShadow], (mesh.material as Material).name).toEqual([true, true])
  const pendulum = cords.parent!
  expect(pot.parent).toBe(pendulum)
  await root.frame()
  const expected = swayRotation(root.state.clock.elapsedTime, HANGING_SWAY, hanging.seed)
  expect(Math.abs(expected.z)).toBeGreaterThan(0.001)
  expect(pendulum.rotation.z).toBeCloseTo(expected.z, 9)
  await root.render(<HangingPlant placement={hanging} animate={false} />)
  await root.frame()
  expect([pendulum.rotation.x, pendulum.rotation.z]).toEqual([0, 0])
})

test('a shelf of books is one mesh that casts and receives, its geometry released on unmount', async () => {
  const root = await mount(<Books spec={shelf} name="books" />)
  const [mesh] = meshes(root)
  expect(meshes(root)).toHaveLength(1)
  expect(mesh.name).toBe('books')
  expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(1000)
  expect([mesh.castShadow, mesh.receiveShadow]).toEqual([true, true])
  const dispose = vi.spyOn(mesh.geometry, 'dispose')
  await root.unmount()
  roots.splice(roots.indexOf(root), 1)
  expect(dispose).toHaveBeenCalledOnce()
})
