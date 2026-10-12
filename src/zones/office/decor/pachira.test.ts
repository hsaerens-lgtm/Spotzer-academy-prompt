// @vitest-environment node
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { normaliseModel, scaleToHeight } from '../../../three/gltf'
import { GLAZING, layout } from '../layout'
import { PACHIRA } from './pachira'

/*
 * The money tree and its clay planter, read from the real Poly Haven files the way assets.test.ts reads them, placed as
 * LargePlants places them. The tree is normalised on its whole box, leaves included, so its trunk does not stand on the
 * model's origin: PACHIRA.offset puts the trunk's base on the planter's axis, which also keeps the leaves off the glass.
 */

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const MODELS = join(ROOT, 'public/assets/models')

/** A model's meshes with their vertices in the glTF's own space (node transforms baked in), one mesh per primitive. */
async function readModel(id: string): Promise<Group> {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  const document = await io.read(join(MODELS, `${id}.glb`))
  const root = new Group()
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')!
      const array = new Float32Array(position.getCount() * 3)
      const element = [0, 0, 0]
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, element)
        const [x, y, z] = element
        array.set([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]], i * 3)
      }
      const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(array, 3))
      root.add(new Mesh(geometry, Object.assign(new MeshBasicMaterial(), { name: primitive.getMaterial()?.getName() ?? '' })))
    }
  }
  return root
}

/** Every vertex of `root`'s meshes whose material is called `material` (or of all of them), in the root's parent space. */
function vertices(root: Group, material?: string): Vector3[] {
  root.updateMatrixWorld(true)
  const found: Vector3[] = []
  for (const mesh of root.children as Mesh[]) {
    if (material && (mesh.material as MeshBasicMaterial).name !== material) continue
    const position = mesh.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) found.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld))
  }
  return found
}

let planter: Vector3[]
let tree: Vector3[]
let bark: Vector3[]
beforeAll(async () => {
  // As the scene stands them: the planter scaled up, the tree scaled to its height, both normalised (standing on y 0, centred).
  const clay = await readModel('planter_pot_clay')
  normaliseModel(clay)
  clay.scale.multiplyScalar(PACHIRA.potScale)
  planter = vertices(clay)
  const model = await readModel('pachira_aquatica_01')
  scaleToHeight(model, PACHIRA.height)
  normaliseModel(model)
  const { offset, base } = PACHIRA
  const place = (v: Vector3) => v.add(new Vector3(offset[0], base, offset[1]))
  tree = vertices(model).map(place)
  bark = vertices(model, 'pachira_aquatica_01_bark').map(place)
})

/** Where the tree stands in the room: the planter at the layout place, turned as the layout turns it. */
function inRoom(v: Vector3): Vector3 {
  const { position, rotationY = 0 } = layout.objects.largePlants.pachira
  return v.clone().applyAxisAngle(new Vector3(0, 1, 0), rotationY).add(new Vector3(...position))
}

test('no leaf or branch of the money tree reaches a glass pane, not even when it sways', () => {
  // The panes: the facade at x -5.02 and the return on the back wall at z -6.02. The tree sways 0.006 rad about its base.
  const panes = { x: GLAZING.side.x - GLAZING.glassInset, z: GLAZING.back.z - GLAZING.glassInset }
  const sway = 0.006 * PACHIRA.height
  const room = tree.map(inRoom)
  expect(room.length).toBeGreaterThan(1000)
  expect(Math.min(...room.map((v) => v.x)) - sway).toBeGreaterThan(panes.x)
  expect(Math.min(...room.map((v) => v.z)) - sway).toBeGreaterThan(panes.z)
})

test('the trunk stands on the planter axis, its base at the soil line, inside the soil disc', () => {
  // The planter's axis and rim: the middle and the top of its highest vertices.
  const rimY = Math.max(...planter.map((v) => v.y))
  const rim = planter.filter((v) => v.y > rimY - 0.01)
  const axis = new Vector3((Math.min(...rim.map((v) => v.x)) + Math.max(...rim.map((v) => v.x))) / 2, 0, (Math.min(...rim.map((v) => v.z)) + Math.max(...rim.map((v) => v.z))) / 2)
  // The trunk's lowest ring.
  const baseY = Math.min(...bark.map((v) => v.y))
  const ring = bark.filter((v) => v.y < baseY + 0.01)
  const centre = new Vector3(ring.reduce((s, v) => s + v.x, 0) / ring.length, 0, ring.reduce((s, v) => s + v.z, 0) / ring.length)
  const radius = Math.max(...ring.map((v) => Math.hypot(v.x - centre.x, v.z - centre.z)))
  expect(Math.hypot(centre.x - axis.x, centre.z - axis.z)).toBeLessThan(0.02)
  expect(Math.hypot(centre.x - axis.x, centre.z - axis.z) + radius).toBeLessThanOrEqual(PACHIRA.soil.radius)
  // At the soil line: not below the soil's surface, not floating over it.
  expect(baseY).toBeGreaterThanOrEqual(PACHIRA.base - 1e-3)
  expect(baseY).toBeLessThanOrEqual(PACHIRA.base + 5e-3)
})

test('the soil disc fills the planter just under its rim', () => {
  const rimY = Math.max(...planter.map((v) => v.y))
  const top = planter.filter((v) => v.y > rimY - 0.01)
  const axis = new Vector3((Math.min(...top.map((v) => v.x)) + Math.max(...top.map((v) => v.x))) / 2, 0, (Math.min(...top.map((v) => v.z)) + Math.max(...top.map((v) => v.z))) / 2)
  // Under the rim by 2 to 5 cm, with the planter's walls closing in (the disc must not poke through them).
  expect(rimY - PACHIRA.base).toBeGreaterThanOrEqual(0.02)
  expect(rimY - PACHIRA.base).toBeLessThanOrEqual(0.05)
  const innermost = Math.min(...planter.filter((v) => v.y >= PACHIRA.base && v.y < rimY - 0.005).map((v) => Math.hypot(v.x - axis.x, v.z - axis.z)))
  // Inside the planter's inner wall at the soil line, with at most 1.5 cm of dark gap to it.
  expect(PACHIRA.soil.radius).toBeLessThanOrEqual(innermost)
  expect(PACHIRA.soil.radius).toBeGreaterThan(innermost - 0.015)
})
