import { Document, WebIO } from '@gltf-transform/core'
import { act, extend } from '@react-three/fiber'
import { Suspense } from 'react'
import { BackSide, Group, Mesh, MeshBasicMaterial, type Object3D, type ShaderMaterial } from 'three'
import { appStore } from '../../core/store'
import { isClockCase } from './clockHands'
import { isClockDeprecation, mountR3F } from '../../test/r3fRoot'
import { resetAppStore } from '../../test/resetAppStore'
import { WallClock } from './WallClock'

/*
 * The wall clock's hover outline through the real component and the real model path (useGLTF, SceneObject, Interactive):
 * it is a ring on the case alone. No network: fetch serves a tiny GLB built here, two quads that stand for the case and,
 * as the glass and the hands are missing from it, a second part that must not be outlined.
 */

/** Two indexed quads (glTF nodes "front" and "back"), 0.4 m wide, 0.5 m tall, so far from the axis that they are all case. */
async function tinyGlb(): Promise<Uint8Array> {
  const document = new Document()
  const buffer = document.createBuffer()
  const material = document.createMaterial('tiny')
  const quad = (name: string, z: number) => {
    const position = document
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([-0.2, 0.1, z, 0.2, 0.1, z, 0.2, 0.6, z, -0.2, 0.6, z]))
      .setBuffer(buffer)
    const indices = document.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer)
    const primitive = document.createPrimitive().setAttribute('POSITION', position).setIndices(indices).setMaterial(material)
    return document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive))
  }
  document.createScene().addChild(quad('front', 0.05)).addChild(quad('back', -0.05))
  return new WebIO().writeBinary(document)
}

// The JSX elements the clock and drei's Outlines mount (<Canvas> registers all of three in the app), and act().
extend({ Group, Mesh, MeshBasicMaterial })
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeAll(async () => {
  const glb = await tinyGlb()
  // three's FileLoader wraps the model URL in a Request, and Node's Request refuses a URL without an origin.
  vi.stubGlobal(
    'Request',
    class {
      url: string
      constructor(url: string) {
        this.url = url
      }
    },
  )
  vi.stubGlobal('fetch', vi.fn(async () => new Response(glb.slice())))
  const warn = console.warn.bind(console)
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) warn(...args)
  })
})
afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
afterEach(() => resetAppStore())

const named = (scene: Object3D, name: string) => {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object as Mesh
}
const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh

/** The meshes drei's Outlines draws below a mesh (mesh, then its group, then the hull). */
const hulls = (mesh: Mesh) => mesh.children.flatMap((child) => child.children).filter(isMesh)

async function mountClock() {
  // drei's Outlines reads the drawing buffer's size from the renderer.
  const root = await mountR3F(
    <Suspense fallback={null}>
      <WallClock />
    </Suspense>,
    { getDrawingBufferSize: (target: { set: (x: number, y: number) => unknown }) => target.set(160, 90) },
  )
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!root.state.scene.getObjectByName('front')) throw new Error('the clock has not loaded')
  })
  // The case carries its outline when the model has been handed over: a render after onModel.
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!named(root.state.scene, 'front').children.some(isMesh)) throw new Error('the clock has no outline ring yet')
  })
  root.state.scene.updateMatrixWorld(true)
  return root
}

test('the clock outline is a ring on its case: an invisible mesh of the case outline, on the case alone', async () => {
  appStore.getState().setHovered('clock')
  const { state } = await mountClock()
  const front = named(state.scene, 'front')
  const back = named(state.scene, 'back')
  // One carrier below the case: invisible itself, drawn from the case's own positions, with one hull outline.
  const carriers = front.children.filter(isMesh)
  expect(carriers).toHaveLength(1)
  expect((carriers[0].material as MeshBasicMaterial).visible).toBe(false)
  expect(carriers[0].geometry.getAttribute('position')).toBe(front.geometry.getAttribute('position'))
  const drawn = hulls(carriers[0])
  expect(drawn).toHaveLength(1)
  expect((drawn[0].material as ShaderMaterial).side).toBe(BackSide)
  // Nothing on the case's own mesh, and nothing on any other mesh of the model.
  expect(hulls(front)).toEqual([])
  expect(back.children).toEqual([])
  // Which mesh is the case is isClockCase's call (clockCase.test.ts reads it from the real model).
  expect(isClockCase(front)).toBe(true)
})

test('the ring draws only while the clock is hovered', async () => {
  const { state } = await mountClock()
  const carrier = named(state.scene, 'front').children.filter(isMesh)[0]
  expect(hulls(carrier)).toEqual([])
  await act(async () => appStore.getState().setHovered('clock'))
  expect(hulls(carrier)).toHaveLength(1)
  await act(async () => appStore.getState().setHovered(null))
  expect(hulls(carrier)).toEqual([])
})
