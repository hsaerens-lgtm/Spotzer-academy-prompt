import { Document, WebIO } from '@gltf-transform/core'
import { act, extend } from '@react-three/fiber'
import { Suspense, type ReactNode } from 'react'
import { BackSide, Box3, Group, Mesh, Vector3, type Object3D, type ShaderMaterial } from 'three'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../test/r3fRoot'
import { modelUrl } from './assets'
import { HoverContext } from './interactive'
import { SceneObject, glbModels } from './objects'

/*
 * The GLB path of SceneObject: a declared model loads through useGLTF, is copied, prepared, scaled and normalised,
 * gets its hover outlines and hands each copy to onModel. No network: fetch serves a tiny GLB built here.
 */

/** Two indexed quads (glTF nodes "front" and "back"): x -0.2..0.2, y 0.1..0.6, z -0.05..0.05, so 0.5 m tall off the floor. */
async function tinyGlb(): Promise<Uint8Array> {
  const document = new Document()
  const buffer = document.createBuffer()
  const material = document.createMaterial('tiny')
  const quad = (name: string, [x0, x1]: [number, number], [y0, y1]: [number, number], z: number) => {
    const position = document
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z]))
      .setBuffer(buffer)
    const indices = document.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer)
    const primitive = document.createPrimitive().setAttribute('POSITION', position).setIndices(indices).setMaterial(material)
    return document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive))
  }
  document
    .createScene()
    .addChild(quad('front', [-0.2, 0.2], [0.1, 0.5], 0.05))
    .addChild(quad('back', [-0.1, 0.1], [0.2, 0.6], -0.05))
  return new WebIO().writeBinary(document)
}

// The JSX elements GltfObject and drei's Outlines mount (<Canvas> registers all of three in the app).
extend({ Group, Mesh })

const requested: string[] = []
beforeAll(async () => {
  const glb = await tinyGlb()
  // three's FileLoader wraps the model URL in a Request, and Node's Request refuses a URL without an origin
  // ('Failed to parse URL'): a plain record of the URL is all the stubbed fetch needs.
  vi.stubGlobal(
    'Request',
    class {
      url: string
      constructor(url: string) {
        this.url = url
      }
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: { url: string }) => {
      requested.push(request.url)
      return new Response(glb.slice())
    }),
  )
  ignoreClockDeprecation()
})
afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
})

/**
 * Mounts `element` in an R3F root with a stand-in renderer (src/test/r3fRoot.tsx) and waits until the object named
 * `ready` is in the scene (the model has loaded). `rerender` replaces the element.
 */
async function mount(element: ReactNode, ready: string) {
  // drei's Outlines reads the drawing buffer's size from the renderer.
  const root = await mountR3F(<Suspense fallback={null}>{element}</Suspense>, {
    getDrawingBufferSize: (target: { set: (x: number, y: number) => unknown }) => target.set(160, 90),
  })
  roots.push(root)
  const { scene } = root.state
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!scene.getObjectByName(ready)) throw new Error(`${ready} has not loaded`)
  })
  scene.updateMatrixWorld(true)
  return { scene, rerender: (node: ReactNode) => root.render(<Suspense fallback={null}>{node}</Suspense>) }
}

function named(scene: Object3D, name: string): Object3D {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object
}

test('a declared model loads from its URL and hands each copy to onModel once', async () => {
  const first = vi.fn()
  const second = vi.fn()
  const { scene, rerender } = await mount(
    <>
      <SceneObject object="clock" name="first" onModel={first} />
      <SceneObject object="clock" name="second" onModel={second} />
    </>,
    'second',
  )
  expect(requested).toContain(modelUrl('wallClock'))
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  const [[firstRoot], [secondRoot]] = [first.mock.calls[0] as [Object3D], second.mock.calls[0] as [Object3D]]
  // Each copy is its own node tree, placed under its own group; the loader's geometry stays shared.
  expect(firstRoot).not.toBe(secondRoot)
  expect(firstRoot.parent).toBe(named(scene, 'first'))
  expect(secondRoot.parent).toBe(named(scene, 'second'))
  expect((named(firstRoot, 'front') as Mesh).geometry).toBe((named(secondRoot, 'front') as Mesh).geometry)
  // A new onModel function on a later render does not run again: once per copy.
  const later = vi.fn()
  await rerender(
    <>
      <SceneObject object="clock" name="first" onModel={later} />
      <SceneObject object="clock" name="second" onModel={later} />
    </>,
  )
  expect(later).not.toHaveBeenCalled()
  expect(first).toHaveBeenCalledTimes(1)
})

test('with outline, each mesh of the model gets a hover outline of its own geometry', async () => {
  // Hovered, so HoverOutline draws drei's Outlines inside each mesh.
  const { scene } = await mount(
    <HoverContext.Provider value>
      <SceneObject object="clock" name="outlined" outline />
      <SceneObject object="clock" name="plain" />
    </HoverContext.Provider>,
    'plain',
  )
  for (const name of ['front', 'back']) {
    const mesh = named(named(scene, 'outlined'), name) as Mesh
    const outlines = mesh.children.flatMap((child) => child.children).filter((child): child is Mesh => (child as Mesh).isMesh)
    expect(outlines, name).toHaveLength(1)
    expect((outlines[0].material as ShaderMaterial).side, name).toBe(BackSide)
    // An indexed geometry: Outlines builds its own non-indexed copy, so disposing it on unhover spares the loader's.
    expect(outlines[0].geometry, name).not.toBe(mesh.geometry)
    expect(named(named(scene, 'plain'), name).children, name).toEqual([])
  }
})

test('height scales the model before it is set on the floor, centred', async () => {
  const { scene } = await mount(
    <>
      <SceneObject object="clock" name="natural" />
      <SceneObject object="clock" name="metre" height={1} />
    </>,
    'metre',
  )
  const box = (name: string) => new Box3().setFromObject(named(scene, name))
  expect(box('natural').getSize(new Vector3()).y).toBeCloseTo(0.5)
  const metre = box('metre')
  const size = metre.getSize(new Vector3())
  expect(size.y).toBeCloseTo(1)
  expect(size.x).toBeCloseTo(0.8) // 0.4 m wide, scaled uniformly by 2
  expect(metre.min.y).toBeCloseTo(0)
  expect(metre.getCenter(new Vector3()).x).toBeCloseTo(0)
  expect(metre.getCenter(new Vector3()).z).toBeCloseTo(0)
})

test('SceneObject throws for an object that nothing draws', () => {
  const declared = glbModels.clock
  delete glbModels.clock
  try {
    expect(() => SceneObject({ object: 'clock' })).toThrow('Nothing draws "clock": declare its model in glbModels.')
  } finally {
    glbModels.clock = declared
  }
})
