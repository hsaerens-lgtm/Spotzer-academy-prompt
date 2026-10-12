import { Document, WebIO } from '@gltf-transform/core'
import { act, extend } from '@react-three/fiber'
import { Group, Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { appStore } from '../../../core/store'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../../test/r3fRoot'
import { resetAppStore } from '../../../test/resetAppStore'
import { MODEL_PARTS, modelUrl } from '../../../three/assets'
import { meshesOf } from '../../../three/gltf'
import { useMaterials } from '../../../three/materials'
import { glbModels } from '../../../three/objects'
import { tints } from '../../../three/tints'
import { layout } from '../layout'
import { PhaseDriver } from '../lighting/PhaseDriver'
import { RIG } from '../lighting/rig'
import { Decor } from './Decor'
import { DecorStage } from './DecorStage'

/*
 * The decor stage of Task 12 through the real model path (useGLTF, AssetBoundary, DecorStage): every item at its layout
 * place, the pendant bulbs driven by the phase, the frames' glass, and a model that cannot load left out on its own.
 * No network: fetch serves tiny GLBs built here, one quad per material; the pendant's wears the bulb material, the
 * frame's its body and its glass (no artwork: painting a poster needs a 2D canvas, which jsdom lacks).
 */

// The office materials wait for the texture sets, which jsdom cannot decode: a stand-in for the shared glass.
vi.mock('../../../three/materials', async (importOriginal) => {
  const { MeshPhysicalMaterial } = await import('three')
  const glass = new MeshPhysicalMaterial({ name: 'glass', transparent: true, opacity: 0.08 })
  return { ...(await importOriginal<typeof import('../../../three/materials')>()), useMaterials: () => ({ glass }) }
})

async function tinyGlb(...materialNames: string[]): Promise<Uint8Array> {
  const document = new Document()
  const buffer = document.createBuffer()
  const mesh = document.createMesh('quad')
  for (const name of materialNames) {
    const position = document
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0, -0.2, 0.4, 0]))
      .setBuffer(buffer)
    const indices = document.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer)
    mesh.addPrimitive(document.createPrimitive().setAttribute('POSITION', position).setIndices(indices).setMaterial(document.createMaterial(name)))
  }
  document.createScene().addChild(document.createNode('quad').setMesh(mesh))
  return new WebIO().writeBinary(document)
}

extend({ Group, Mesh })

const FRAME_BODY = 'hanging_picture_frame_01'
const FRAME_GLASS = 'hanging_picture_frame_01_glass'
const MISSING = 'assets/models/missing_coffee_table.glb'
let warnings: unknown[][]
let errors: unknown[][]
beforeAll(async () => {
  const plain = await tinyGlb('wood')
  const models = new Map([
    [modelUrl('pendantLamp'), await tinyGlb(MODEL_PARTS.pendantBulb)],
    [modelUrl('pictureFrame'), await tinyGlb(FRAME_BODY, FRAME_GLASS)],
  ])
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async ({ url }: { url: string }) => {
      if (url.endsWith(MISSING)) return new Response(null, { status: 404 })
      return new Response((models.get(url) ?? plain).slice())
    }),
  )
})
afterAll(() => {
  vi.unstubAllGlobals()
})
beforeEach(() => {
  resetAppStore({ phase: 'day' })
  warnings = []
  errors = []
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) warnings.push(args)
  })
  // Without window.reportError (jsdom), R3F's root reports a caught error on console.error.
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args)
  })
})
const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  vi.restoreAllMocks()
})

/** The decor stage with the phase driver, once decorReady is set. */
async function mountDecor(): Promise<TestRoot> {
  const root = await mountR3F(
    <>
      <PhaseDriver />
      <DecorStage>
        <Decor />
      </DecorStage>
    </>,
    { compileAsync: () => Promise.resolve() },
  )
  roots.push(root)
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!appStore.getState().decorReady) throw new Error('the decor is not ready')
  })
  return root
}

function named(scene: Object3D, name: string): Object3D {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object
}

function isInside(object: Object3D, ancestor: Object3D): boolean {
  for (let parent = object.parent; parent; parent = parent.parent) if (parent === ancestor) return true
  return false
}

const PLACED = [
  ['cabinet', layout.objects.cabinet],
  ['coffeeTable', layout.objects.coffeeTable],
  ...layout.objects.pendants.map((pendant, i) => [`pendant-${i}`, pendant] as const),
  ...layout.objects.frames.map((frame, i) => [`frame-${i}`, frame] as const),
] as const

test('every decor item stands at its layout place in the decor group, the drawer cabinet as the group "cabinet"', async () => {
  const { state } = await mountDecor()
  const decor = named(state.scene, 'decor')
  expect(decor.visible).toBe(true)
  for (const [name, placement] of PLACED) {
    const item = named(state.scene, name)
    expect(isInside(item, decor), name).toBe(true)
    expect(item.position.toArray(), name).toEqual(placement.position)
    expect(item.rotation.y, name).toBeCloseTo(placement.rotationY ?? 0)
  }
  expect(warnings).toEqual([])
  expect(errors).toEqual([])
})

test('the three pendants share one warm bulb, off by day and at its peak at night', async () => {
  const root = await mountDecor()
  const bulbs = [0, 1, 2].map((i) => meshesOf(named(root.state.scene, `pendant-${i}`))[0].material as MeshStandardMaterial)
  expect(new Set(bulbs).size).toBe(1)
  const [bulb] = bulbs
  expect(bulb.name).toBe(MODEL_PARTS.pendantBulb)
  expect(bulb.emissive.getHexString()).toBe(tints.warmLight.slice(1))
  expect(bulb.userData.auditExempt).toBe('emissive')
  await root.frame()
  expect(bulb.emissiveIntensity).toBe(0)
  await act(async () => appStore.getState().setPhase('night'))
  await root.frame()
  expect(bulb.emissiveIntensity).toBeCloseTo(RIG.emissivePeak)
})

// hanging_picture_frame_01's glass is the frame's own colour map, metallic, with an opacity map the CC0 download leaves
// out: drawn as it comes, it is an opaque dark sheet over the poster.
test('the frames are glazed with the office glass, so their posters show through', async () => {
  const { state } = await mountDecor()
  const { glass } = useMaterials()
  for (const i of [0, 1]) {
    const materials = meshesOf(named(state.scene, `frame-${i}`)).map((mesh) => mesh.material as MeshStandardMaterial)
    expect(materials.map((material) => material.name), `frame-${i}`).toEqual([FRAME_BODY, 'glass'])
    expect(materials[1], `frame-${i}`).toBe(glass)
  }
})

// Review focus 3: a model that cannot load (404) is left out on its own; the rest of the decor shows and decorReady is set.
test('a decor model that cannot load is left out, and the rest of the decor shows', async () => {
  const declared = glbModels.coffeeTable
  glbModels.coffeeTable = MISSING
  try {
    const { state } = await mountDecor()
    expect(state.scene.getObjectByName('coffeeTable')).toBeUndefined()
    for (const [name] of PLACED.filter(([name]) => name !== 'coffeeTable')) expect(state.scene.getObjectByName(name), name).toBeDefined()
    expect(named(state.scene, 'decor').visible).toBe(true)
    expect(warnings).toEqual([['Decor item "coffeeTable" failed to load and is left out.', expect.any(Error)]])
    // The caught error, as R3F's root reports it (on a page: a cancelled window "error" event, see AssetBoundary.test).
    expect(errors.length).toBeGreaterThan(0)
    for (const [error] of errors) expect(String(error)).toContain(MISSING)
  } finally {
    glbModels.coffeeTable = declared
  }
})
