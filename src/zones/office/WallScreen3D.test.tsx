import { act, extend } from '@react-three/fiber'
import { Group, Mesh, PlaneGeometry } from 'three'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { WallScreen3D } from './WallScreen3D'

/*
 * The wall screen is a hole in the canvas: drei's occlusion plane writes a transparent pixel where the DOM page behind
 * the canvas shows. three draws opaque objects by material before depth, so the oak slats and the dark screen plane
 * behind the hole were lit and shaded first, then covered: in the presentation view, about a third of the picture
 * shaded twice for nothing (Task 14b, about 6 ms a frame on the reference iGPU).
 */

// drei's Html needs a DOM portal and connected pointer events: a stand-in group that keeps the props the screen gives it.
vi.mock('@react-three/drei', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/drei')>()),
  Html: ({ renderOrder }: { renderOrder?: number }) => <group name="screen-html" renderOrder={renderOrder} />,
}))

// The materials wait for the texture sets: a plain stand-in.
vi.mock('../../three/materials', async (importOriginal) => {
  const { MeshStandardMaterial } = await import('three')
  const plain = new MeshStandardMaterial()
  return { ...(await importOriginal<typeof import('../../three/materials')>()), useMaterials: () => ({ blackMetal: plain, screenOff: plain }) }
})

// The JSX elements the screen mounts (<Canvas> registers all of three in the app).
extend({ Group, Mesh, PlaneGeometry })

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) throw new Error(`unexpected warning: ${String(args[0])}`)
  })
})
let root: TestRoot | null = null
afterEach(async () => {
  await root?.unmount()
  root = null
  vi.restoreAllMocks()
})

test('the hole of the wall screen is drawn before everything opaque', async () => {
  root = await mountR3F(<WallScreen3D />)
  const { state } = root
  // drei's Html mounts once the canvas takes pointer events (WallScreen3D waits for it).
  await act(async () => {
    state.set({ events: { ...state.events, connected: state.gl.domElement } })
  })
  const html = state.scene.getObjectByName('screen-html')
  expect(html).toBeDefined()
  // three gives a group's renderOrder to everything inside it, before any other sort key: the occlusion plane in drei's
  // Html group fills the depth buffer first, and the depth test then skips what stands behind the screen.
  expect(html!.renderOrder).toBeLessThan(0)
  state.scene.traverse((object) => {
    if (object !== html && !html!.getObjectById(object.id)) expect(object.renderOrder, object.name || object.type).toBeGreaterThan(html!.renderOrder)
  })
})
