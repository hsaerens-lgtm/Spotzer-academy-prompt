import { Document, WebIO } from '@gltf-transform/core'
import { act, extend } from '@react-three/fiber'
import { Box3, Group, Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { QualityContext, type Quality } from '../../../app/quality'
import { appStore } from '../../../core/store'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../../test/r3fRoot'
import { resetAppStore } from '../../../test/resetAppStore'
import { GLASS_MATERIAL, MODEL_PARTS, modelUrl } from '../../../three/assets'
import { meshesOf } from '../../../three/gltf'
import { useMaterials } from '../../../three/materials'
import { glbModels } from '../../../three/objects'
import { HANGING_SWAY } from '../../../three/plants/HangingPlant'
import { swayRotation } from '../../../three/plants/sway'
import { tints } from '../../../three/tints'
import { layout } from '../layout'
import { PhaseDriver } from '../lighting/PhaseDriver'
import { RIG } from '../lighting/rig'
import { Decor } from './Decor'
import { DecorStage } from './DecorStage'
import { LARGE_PLANT_SWAY, PACHIRA } from './LargePlants'
import { vasePlantPosition } from './Vases'

/*
 * The decor stage (Tasks 12 and 14) through the real model path (useGLTF, AssetBoundary, DecorStage): every item at its
 * layout place, the pendant bulbs driven by the phase, the frames' glass, the plants that sway on the high and medium
 * tiers only, the shadow rule, and a model that cannot load left out on its own.
 * No network: fetch serves tiny GLBs built here, one quad per material; the pendant's wears the bulb material, the
 * frame's its body and its glass (no artwork: painting a poster needs a 2D canvas, which jsdom lacks).
 */

// The books' atlas is painted on a canvas, which jsdom does not have: the books get a plain material here.
vi.mock('../../../three/shelfBooks', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../three/shelfBooks')>()
  const { MeshStandardMaterial } = await import('three')
  const material = new MeshStandardMaterial({ name: 'books' })
  return { ...original, booksMaterial: () => material }
})

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

/** The decor stage with the phase driver on a quality tier, once decorReady is set. */
async function mountDecor(quality: Quality = 'high'): Promise<TestRoot> {
  const root = await mountR3F(
    <QualityContext.Provider value={quality}>
      <PhaseDriver />
      <DecorStage>
        <Decor />
      </DecorStage>
    </QualityContext.Provider>,
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
  ['pottedPlant', layout.objects.largePlants.pottedPlant],
  ['pachira', layout.objects.largePlants.pachira],
  ...layout.objects.vases.map((vase, i) => [`vase-${i}`, vase] as const),
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

test('the generated plants, the vase plants, the hanging plants and the shelf books stand at their layout places', async () => {
  const { state } = await mountDecor()
  const decor = named(state.scene, 'decor')
  const placed: [string, readonly number[]][] = [
    ...layout.objects.plants.map((plant, i) => [`plant-${i}`, plant.position] as [string, readonly number[]]),
    ...layout.objects.hangingPlants.map((plant, i) => [`hangingPlant-${i}`, plant.position] as [string, readonly number[]]),
    ...layout.objects.vases.map((vase, i) => [`vasePlant-${i}`, vasePlantPosition(vase)] as [string, readonly number[]]),
  ]
  expect(placed).toHaveLength(8 + 2 + 2)
  for (const [name, position] of placed) {
    const item = named(state.scene, name)
    expect(isInside(item, decor), name).toBe(true)
    expect(item.position.toArray(), name).toEqual(position)
  }
  // The books are room coordinates baked into one mesh per shelf.
  layout.objects.shelfBooks.forEach((_, i) => {
    const books = named(state.scene, `books-${i}`)
    expect((books as Mesh).isMesh, `books-${i}`).toBe(true)
    expect(isInside(books, decor), `books-${i}`).toBe(true)
  })
  expect(warnings).toEqual([])
  expect(errors).toEqual([])
})

// The money tree: the clay planter scaled up, the tree scaled to its height and standing on the planter's soil line.
test('the pachira stands in its enlarged clay planter, the tree 1.55 m tall from the soil line', async () => {
  const { state } = await mountDecor()
  const pachira = named(state.scene, 'pachira')
  const [planter, tree] = pachira.children
  expect(planter.scale.toArray()).toEqual([PACHIRA.potScale, PACHIRA.potScale, PACHIRA.potScale])
  expect(tree.position.y).toBe(PACHIRA.base)
  const box = new Box3().setFromObject(tree)
  expect(box.min.y).toBeCloseTo(PACHIRA.base, 6)
  expect(box.max.y - box.min.y).toBeCloseTo(PACHIRA.height, 6)
  // The potted plant keeps its own pot and its model's size.
  expect(named(state.scene, 'pottedPlant').children).toHaveLength(1)
})

/** What sways, with its amplitude and phase: a generated plant, a vase plant, a hanging plant and the two large plants. */
function swaying(scene: Object3D): [Object3D, number, number][] {
  const canopyGroup = (name: string) => meshesOf(named(scene, name)).at(-1)!.parent!
  const { plants, hangingPlants, vases } = layout.objects
  return [
    [canopyGroup('plant-1'), plants[1].sway, plants[1].seed],
    [canopyGroup('plant-4'), plants[4].sway, plants[4].seed],
    [canopyGroup('vasePlant-1'), vases[1].plant.sway, vases[1].plant.seed],
    [meshesOf(named(scene, 'hangingPlant-0'))[0].parent!, HANGING_SWAY, hangingPlants[0].seed],
    [named(scene, 'pottedPlant').children[0], LARGE_PLANT_SWAY, 1.3],
    [named(scene, 'pachira').children[1], LARGE_PLANT_SWAY, 4.7],
  ]
}

// Spec section 7: plants move on the high and medium tiers; section 8: never with reduced motion.
test.each<Quality>(['high', 'medium'])('on the %s tier the plants sway about their base', async (quality) => {
  const root = await mountDecor(quality)
  await root.frame()
  await root.frame()
  for (const [group, amplitude, phase] of swaying(root.state.scene)) {
    const expected = swayRotation(root.state.clock.elapsedTime, amplitude, phase)
    expect(Math.abs(expected.z), group.parent?.name).toBeGreaterThan(amplitude / 20)
    expect(group.rotation.z, group.parent?.name).toBeCloseTo(expected.z, 9)
    expect(group.rotation.x, group.parent?.name).toBeCloseTo(expected.x, 9)
  }
})

test('the plants stand still on the low tier and with reduced motion', async () => {
  for (const [quality, reducedMotion] of [['low', false], ['high', true]] as const) {
    resetAppStore({ phase: 'day', reducedMotion })
    const root = await mountDecor(quality)
    await root.frame()
    await root.frame()
    for (const [group] of swaying(root.state.scene)) {
      expect([group.rotation.x, group.rotation.z], `${quality}, reduced motion ${reducedMotion}: ${group.parent?.name}`).toEqual([0, 0])
    }
    await root.unmount()
    roots.splice(roots.indexOf(root), 1)
  }
})

// Shadow rule: every mesh that is neither glass nor emissive both casts and receives; glass receives only.
test('every mesh of the decor casts and receives shadows, but for the glass and the bulbs', async () => {
  const { state } = await mountDecor()
  const items = ['cabinet', 'coffeeTable', 'pendant-0', 'frame-0', 'pottedPlant', 'pachira', 'vase-0', 'vase-1', 'plant-0', 'hangingPlant-1', 'vasePlant-0', 'books-0', 'books-1']
  for (const name of items) expect(meshesOf(named(state.scene, name)).length, name).toBeGreaterThan(0)
  for (const mesh of meshesOf(named(state.scene, 'decor'))) {
    const [material] = [mesh.material].flat()
    if (material.userData.auditExempt === 'emissive') continue
    const glass = GLASS_MATERIAL.test(material.name) || material === useMaterials().glass // the frames' panes wear the office glass
    expect(mesh.receiveShadow, `${mesh.parent?.name} ${material.name} receives`).toBe(true)
    expect(mesh.castShadow, `${mesh.parent?.name} ${material.name} casts`).toBe(!glass)
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
