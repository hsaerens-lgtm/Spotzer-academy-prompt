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
 * The planter is measured in the frame of the scene: normalised (its box centred on the origin), then carried by a parent
 * group that scales it, exactly as GltfObject places a model with a scale (<group scale><primitive/></group>). Scaling the
 * normalised object itself, as this test did before, scales its position too little and moves the planter's axis by
 * 0.6 of the model's own off-centre (7 mm here), so the trunk and the soil were fitted to a planter that is not where it is.
 */

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const MODELS = join(ROOT, 'public/assets/models')

/** A model's meshes with their vertices in the glTF's own space (node transforms baked in), one indexed mesh per primitive. */
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
      const indices = primitive.getIndices()
      if (indices) geometry.setIndex(new BufferAttribute(Uint32Array.from(indices.getArray()!), 1))
      root.add(new Mesh(geometry, Object.assign(new MeshBasicMaterial(), { name: primitive.getMaterial()?.getName() ?? '' })))
    }
  }
  return root
}

/** Every vertex of `root`'s meshes whose material is called `material` (or of all of them), in world space. */
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

/** Where the horizontal plane at height `y` cuts the triangles of `root`'s meshes, as [x, z] points in world space. */
function slice(root: Group, y: number): [number, number][] {
  root.updateMatrixWorld(true)
  const points: [number, number][] = []
  for (const mesh of root.children as Mesh[]) {
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()!
    const world = Array.from({ length: position.count }, (_, i) => new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld))
    for (let t = 0; t < index.count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = world[index.getX(t + k)]
        const b = world[index.getX(t + ((k + 1) % 3))]
        if ((a.y - y) * (b.y - y) >= 0) continue
        const f = (y - a.y) / (b.y - a.y)
        points.push([a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f])
      }
    }
  }
  return points
}

const SECTORS = 36
/** Per 10-degree sector about `centre`: the points of the cut, nearest first (radii in metres). */
function bySector(points: [number, number][], centre: [number, number]): { radius: number; x: number; z: number }[][] {
  const sectors = Array.from({ length: SECTORS }, () => [] as { radius: number; x: number; z: number }[])
  for (const [x, z] of points) {
    const angle = Math.atan2(z - centre[1], x - centre[0])
    sectors[Math.min(SECTORS - 1, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * SECTORS))].push({ radius: Math.hypot(x - centre[0], z - centre[1]), x, z })
  }
  for (const sector of sectors) sector.sort((a, b) => a.radius - b.radius)
  return sectors
}

/**
 * A planter wall is a pair of surfaces: the cut has an inner and an outer contour. The inner one is, in every sector, the
 * points before the first jump of more than 6 mm (the wall is at least 1 cm thick at the soil line).
 */
function innerContour(points: [number, number][], centre: [number, number]): [number, number][] {
  const inner: [number, number][] = []
  for (const sector of bySector(points, centre)) {
    for (let i = 0; i < sector.length; i++) {
      if (i > 0 && sector[i].radius - sector[i - 1].radius > 0.006) break
      inner.push([sector[i].x, sector[i].z])
    }
  }
  return inner
}

/** Least-squares circle through points (Kasa's algebraic fit): its centre and radius. */
function circleFit(points: [number, number][]): { x: number; z: number; radius: number } {
  const n = points.length
  let sx = 0
  let sz = 0
  let sxx = 0
  let sxz = 0
  let szz = 0
  let sxr = 0
  let szr = 0
  let sr = 0
  for (const [x, z] of points) {
    const r = x * x + z * z
    sx += x
    sz += z
    sxx += x * x
    sxz += x * z
    szz += z * z
    sxr += x * r
    szr += z * r
    sr += r
  }
  const A = [
    [sxx, sxz, sx],
    [sxz, szz, sz],
    [sx, sz, n],
  ]
  const B = [sxr, szr, sr]
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const swap = (column: number) => A.map((row, r) => row.map((value, c) => (c === column ? B[r] : value)))
  const d = det(A)
  const x = det(swap(0)) / d / 2
  const z = det(swap(1)) / d / 2
  return { x, z, radius: Math.sqrt(det(swap(2)) / d + x * x + z * z) }
}

let planter: Vector3[]
let wall: [number, number][]
let tree: Vector3[]
let bark: Vector3[]
beforeAll(async () => {
  // As the scene stands them: the planter normalised, then scaled up by the group that carries it; the tree scaled to
  // its height and normalised.
  const clay = await readModel('planter_pot_clay')
  normaliseModel(clay)
  const scaled = new Group()
  scaled.scale.setScalar(PACHIRA.potScale)
  scaled.add(clay)
  scaled.updateMatrixWorld(true) // the meshes' world matrices carry the group's scale from here on
  planter = vertices(clay)
  wall = slice(clay, PACHIRA.base)
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

test('the origin of the planter group is the planter axis, and the trunk stands on it, inside the soil', () => {
  // The planter's axis: the circle that fits the inner wall at the soil line. The planter group's origin is where the soil is.
  const axis = circleFit(innerContour(wall, [0, 0]))
  expect(wall.length).toBeGreaterThan(300)
  expect(Math.hypot(axis.x, axis.z)).toBeLessThan(0.004)
  // The trunk's lowest ring.
  const baseY = Math.min(...bark.map((v) => v.y))
  const ring = bark.filter((v) => v.y < baseY + 0.01)
  const centre = new Vector3(ring.reduce((s, v) => s + v.x, 0) / ring.length, 0, ring.reduce((s, v) => s + v.z, 0) / ring.length)
  const radius = Math.max(...ring.map((v) => Math.hypot(v.x - centre.x, v.z - centre.z)))
  expect(Math.hypot(centre.x - axis.x, centre.z - axis.z)).toBeLessThan(0.005)
  expect(Math.hypot(centre.x, centre.z) + radius).toBeLessThanOrEqual(PACHIRA.soil.radius)
  // At the soil line: not below the soil's surface, not floating over it.
  expect(baseY).toBeGreaterThanOrEqual(PACHIRA.base - 1e-3)
  expect(baseY).toBeLessThanOrEqual(PACHIRA.base + 5e-3)
})

test('the soil fills the planter at the soil line: no band of clay wider than 5 mm shows between it and the wall', () => {
  // The cut of the planter at the soil line, about the soil's centre (the group origin): the inner contour is the wall
  // the soil meets, the outer contour is the outside of the clay. The planter is a scan, out of round by about 5 mm.
  const sectors = bySector(wall, [0, 0])
  expect(sectors.every((sector) => sector.length > 0)).toBe(true)
  const inner = sectors.map((sector) => sector[0].radius)
  const outer = sectors.map((sector) => sector[sector.length - 1].radius)
  // The widest gap between the disc's edge and the wall, all round: at most 5 mm.
  expect(Math.max(...inner) - PACHIRA.soil.radius).toBeLessThanOrEqual(0.005)
  // Where the wall is nearer than the disc's edge, the edge is inside the clay, out of sight; it must not come out the other side.
  expect(PACHIRA.soil.radius).toBeLessThan(Math.min(...outer))
})

test('the soil is set under the rim', () => {
  // The soil line lies 2 to 5 cm under the planter's rim.
  const rimY = Math.max(...planter.map((v) => v.y))
  expect(rimY - PACHIRA.base).toBeGreaterThanOrEqual(0.02)
  expect(rimY - PACHIRA.base).toBeLessThanOrEqual(0.05)
})
