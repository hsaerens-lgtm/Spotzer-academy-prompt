import { Document, WebIO } from '@gltf-transform/core'
import { act, extend } from '@react-three/fiber'
import { Suspense } from 'react'
import { BackSide, Group, Mesh, MeshBasicMaterial, type Object3D, type ShaderMaterial } from 'three'
import { appStore } from '../../core/store'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { resetAppStore } from '../../test/resetAppStore'
import { isClockCase } from './clockCase'
import { WallClock } from './WallClock'

/*
 * The wall clock's hover outline through the real component and the real model path (useGLTF, SceneObject, Interactive):
 * it is a ring on the case alone. No network: fetch serves a tiny GLB built here, a stand-in for the model's case and the
 * glass over it, in the model's order and with its material names: the glass is not the case (isClockCase), so it must
 * not be outlined. The hands are left out (clockCase.test.ts checks them on the real model).
 */

/**
 * Two indexed quads, 0.4 m wide and 0.5 m tall, so far from the axis that every triangle is on the case's outer shell:
 * the case (glTF node "case", material "wall_clock"), then the glass in front of it ("glass", "wall_clock_glass").
 */
async function tinyGlb(): Promise<Uint8Array> {
  const document = new Document()
  const buffer = document.createBuffer()
  const quad = (name: string, material: string, z: number) => {
    const position = document
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([-0.2, 0.1, z, 0.2, 0.1, z, 0.2, 0.6, z, -0.2, 0.6, z]))
      .setBuffer(buffer)
    const indices = document.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer)
    const primitive = document
      .createPrimitive()
      .setAttribute('POSITION', position)
      .setIndices(indices)
      .setMaterial(document.createMaterial(material))
    return document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive))
  }
  document.createScene().addChild(quad('case', 'wall_clock', -0.05)).addChild(quad('glass', 'wall_clock_glass', 0.05))
  return new WebIO().writeBinary(document)
}

// The JSX elements the clock and drei's Outlines mount (<Canvas> registers all of three in the app).
extend({ Group, Mesh, MeshBasicMaterial })

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
  ignoreClockDeprecation()
})
afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  resetAppStore()
})

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
  roots.push(root)
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!root.state.scene.getObjectByName('case')) throw new Error('the clock has not loaded')
  })
  // The case carries its outline when the model has been handed over: a render after onModel.
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!named(root.state.scene, 'case').children.some(isMesh)) throw new Error('the clock has no outline ring yet')
  })
  root.state.scene.updateMatrixWorld(true)
  return root
}

test('the clock outline is a ring on its case: an invisible mesh of the case outline, on the case alone', async () => {
  appStore.getState().setHovered('clock')
  const { state } = await mountClock()
  const body = named(state.scene, 'case')
  const glass = named(state.scene, 'glass')
  // Which mesh is the case is isClockCase's call: the glass fails it by its material, as in the real model.
  expect(isClockCase(body)).toBe(true)
  expect(isClockCase(glass)).toBe(false)
  // One carrier below the case: invisible itself, drawn from the case's own positions, with one hull outline.
  const carriers = body.children.filter(isMesh)
  expect(carriers).toHaveLength(1)
  expect((carriers[0].material as MeshBasicMaterial).visible).toBe(false)
  expect(carriers[0].geometry.getAttribute('position')).toBe(body.geometry.getAttribute('position'))
  const drawn = hulls(carriers[0])
  expect(drawn).toHaveLength(1)
  expect((drawn[0].material as ShaderMaterial).side).toBe(BackSide)
  // Nothing on the case's own mesh, and nothing on the glass.
  expect(hulls(body)).toEqual([])
  expect(glass.children).toEqual([])
})

test('the ring draws only while the clock is hovered', async () => {
  const { state } = await mountClock()
  const carrier = named(state.scene, 'case').children.filter(isMesh)[0]
  expect(hulls(carrier)).toEqual([])
  await act(async () => appStore.getState().setHovered('clock'))
  expect(hulls(carrier)).toHaveLength(1)
  await act(async () => appStore.getState().setHovered(null))
  expect(hulls(carrier)).toEqual([])
})
