import { act, extend } from '@react-three/fiber'
import { Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { WallScreen3D } from './WallScreen3D'

/*
 * The wall screen is a hole in the canvas: drei's occlusion plane writes a transparent pixel where the DOM page behind
 * the canvas shows. three draws opaque objects by material before depth, so the oak slats and the dark screen plane
 * behind the hole were lit and shaded first, then covered: in the presentation view, about a third of the picture
 * shaded twice for nothing (Task 14b, about 6 ms a frame on the reference iGPU).
 */

// drei's Html needs a DOM portal and connected pointer events: a stand-in group that keeps the props the screen gives it.
// The stand-in relies on what drei 10.7.9's Html does with them: it spreads its other props (renderOrder among them)
// onto the group that holds its occlusion mesh. The last test checks that against the real Html, so a drei upgrade that
// stops doing it fails here rather than slowing the presentation view down.
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

// The JSX elements the screen and drei's Html mount (<Canvas> registers all of three in the app).
extend({ Group, Mesh, PlaneGeometry, ShaderMaterial })

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

test("drei's real Html spreads renderOrder onto the group that holds its occlusion mesh", async () => {
  const { Html } = await vi.importActual<typeof import('@react-three/drei')>('@react-three/drei')
  root = await mountR3F(
    <Html transform occlude="blending" renderOrder={-1} name="real-html">
      <div />
    </Html>,
  )
  const group = root.state.scene.getObjectByName('real-html') as Group
  expect(group.isGroup).toBe(true)
  expect(group.renderOrder).toBe(-1)
  // The occlusion plane (drei's transparent ShaderMaterial) is inside it: three sorts it by its group's renderOrder,
  // which only a Group passes down (groupOrder).
  const occluders = group.children.filter((child) => (child as Mesh).material instanceof ShaderMaterial)
  expect(occluders).toHaveLength(1)
})
