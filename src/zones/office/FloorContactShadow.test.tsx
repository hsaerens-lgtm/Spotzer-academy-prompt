import { act, extend } from '@react-three/fiber'
import { Group, Mesh, MeshBasicMaterial, OrthographicCamera, Vector3, type Camera, type Object3D } from 'three'
import { appStore } from '../../core/store'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { resetAppStore } from '../../test/resetAppStore'
import { FLOOR_SHADOW, FloorContactShadow } from './FloorContactShadow'
import { CONTACT_SHADOW_Y, ROOM } from './layout'

/*
 * The floor contact shadow (Task 12 ruling): one drei ContactShadows over the whole room, drawn once per render of the
 * component (frames={1}), and rendered again when the base and then the decor become ready, so both stand on it.
 */

// The JSX elements drei's ContactShadows mounts (<Canvas> registers all of three in the app).
extend({ Group, Mesh, MeshBasicMaterial, OrthographicCamera })

beforeEach(() => {
  resetAppStore()
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) throw new Error(`unexpected warning: ${String(args[0])}`)
  })
})
const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  vi.restoreAllMocks()
})

/** Mounts the shadow with a stand-in renderer that counts the depth passes: the scene seen by the shadow camera. */
async function mount() {
  const passes: Camera[] = []
  const render = (scene: Object3D, camera: Camera) => {
    if ((scene as { isScene?: boolean }).isScene && (camera as OrthographicCamera).isOrthographicCamera) passes.push(camera)
  }
  const root = await mountR3F(<FloorContactShadow />, { render, setRenderTarget: () => {} })
  roots.push(root)
  return { root, passes }
}

function shadowPlane(scene: Object3D): Mesh {
  let plane: Mesh | undefined
  scene.traverse((object) => {
    if ((object as Mesh).isMesh && ((object as Mesh).material as MeshBasicMaterial).map) plane = object as Mesh
  })
  if (!plane) throw new Error('no shadow plane')
  return plane
}

test('the floor shadow is drawn again when the base and then the decor become ready', async () => {
  const { root, passes } = await mount()
  const map = (shadowPlane(root.state.scene).material as MeshBasicMaterial).map
  await root.frame()
  await root.frame()
  expect(passes).toHaveLength(1)
  // The base was hidden while its shaders compiled: one more pass once it shows.
  await act(async () => appStore.getState().setSceneReady(true))
  await root.frame()
  await root.frame()
  expect(passes).toHaveLength(2)
  // The decor (cabinet, coffee table...) arrives later: one more pass.
  await act(async () => appStore.getState().setDecorReady(true))
  await root.frame()
  await root.frame()
  expect(passes).toHaveLength(3)
  // Into the same render target: the props are constant, so drei builds its targets once (none left behind).
  expect((shadowPlane(root.state.scene).material as MeshBasicMaterial).map).toBe(map)
})

test('the shadow covers the room from just above the floor, its near plane under drei\'s blur plane', async () => {
  const { root, passes } = await mount()
  await root.frame()
  const [camera] = passes as OrthographicCamera[]
  expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-ROOM.width / 2, ROOM.width / 2, ROOM.depth / 2, -ROOM.depth / 2])
  // Centred on the world origin, where drei 10.7.9 draws the plane its blur passes read.
  const position = camera.getWorldPosition(new Vector3())
  expect(position.x).toBeCloseTo((ROOM.x0 + ROOM.x1) / 2)
  expect(position.z).toBeCloseTo((ROOM.z0 + ROOM.z1) / 2)
  expect(position.y).toBeCloseTo(CONTACT_SHADOW_Y)
  // That plane lies at y 0, under the camera: inside the near plane. The floor's surface faces up, out of sight.
  expect(camera.near).toBe(FLOOR_SHADOW.near)
  expect(camera.near).toBeLessThan(-CONTACT_SHADOW_Y)
  expect(camera.far).toBe(FLOOR_SHADOW.far)
})
