// @vitest-environment node
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, type Object3D } from 'three'
import { MODEL_PARTS } from '../../three/assets'
import { CASE_RING_FROM, caseRing, isClockCase } from './clockHands'

/*
 * The wall clock's hover outline is a ring round its case, and nothing else. The clock model is one mesh for the case and
 * its dial, one for the glass over them and three hand nodes; outlining every mesh haloed the hands and drew a second ring
 * round the glass, and outlining the case-and-dial mesh draws a hairline ring inside the bezel, where its inner wall and
 * the rim of the dial are: the outline is drawn from the outer shell of the case alone. The scene graph below is the
 * real GLB's, built the way three's GLTFLoader builds it: a node with several primitives is a Group of one Mesh per
 * primitive, a node with one is that Mesh.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

async function clockScene(): Promise<Group> {
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  const document = await io.read(join(ROOT, 'public/assets/models/wall_clock.glb'))
  const scene = new Group()
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const parts = mesh.listPrimitives().map((primitive, i) => {
      const geometry = new BufferGeometry()
      const position = primitive.getAttribute('POSITION')!
      const array = new Float32Array(position.getCount() * 3)
      const element = [0, 0, 0]
      for (let v = 0; v < position.getCount(); v++) {
        position.getElement(v, element)
        array.set(element, v * 3)
      }
      geometry.setAttribute('position', new BufferAttribute(array, 3))
      geometry.setIndex(new BufferAttribute(Uint32Array.from(primitive.getIndices()!.getArray()!), 1))
      // The loader drops the characters a node path reserves from a mesh's name, and numbers the primitives after the first.
      const name = mesh.getName().replace(/[[\].:/]/g, '') + (i > 0 ? `_${i}` : '')
      return Object.assign(new Mesh(geometry, Object.assign(new MeshBasicMaterial(), { name: primitive.getMaterial()?.getName() ?? '' })), { name })
    })
    if (parts.length === 1) scene.add(Object.assign(parts[0], { name: node.getName() }))
    else scene.add(Object.assign(new Group(), { name: node.getName() }).add(...parts))
  }
  return scene
}

const materialName = (mesh: Mesh) => (mesh.material as MeshBasicMaterial).name
const vertexCount = (mesh: Mesh) => mesh.geometry.getAttribute('position').count

async function clockMeshes(): Promise<Mesh[]> {
  const meshes: Mesh[] = []
  ;(await clockScene()).traverse((object: Object3D) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })
  return meshes
}

test('the case is the one mesh that is neither the glass nor a hand', async () => {
  const meshes = await clockMeshes()
  // The case with its dial, the glass over it and the three hands.
  expect(meshes).toHaveLength(5)
  for (const name of Object.values(MODEL_PARTS.clockHands)) expect(meshes.map((mesh) => mesh.name), name).toContain(name)
  const picked = meshes.filter(isClockCase)
  expect(picked).toHaveLength(1)
  expect(picked[0].parent?.name).toBe('wall_clock')
  expect(materialName(picked[0])).toBe('wall_clock')
  // The case-and-dial mesh, not a hand (a hand has fewer than 300 vertices, the case 2832).
  expect(vertexCount(picked[0])).toBeGreaterThan(1000)
  // What it leaves out: the glass, and the hands, which share the case's material.
  expect(meshes.filter((mesh) => !isClockCase(mesh)).map(materialName).sort()).toEqual(['wall_clock', 'wall_clock', 'wall_clock', 'wall_clock_glass'])
})

test('the outline ring is the outer shell of the case: the bezel and the back, not its inner wall or the rim of the dial', async () => {
  const [body] = (await clockMeshes()).filter(isClockCase)
  const source = body.geometry
  const ring = caseRing(source)
  const position = ring.getAttribute('position')
  const index = ring.getIndex()!
  const radius = (i: number) => Math.hypot(position.getX(i), position.getY(i))
  // Every triangle of the ring lies wholly outside CASE_RING_FROM (the inner wall of the bezel stands at 0.14 to 0.145 m).
  expect(CASE_RING_FROM).toBeGreaterThan(0.145)
  expect(CASE_RING_FROM).toBeLessThan(0.15)
  for (let t = 0; t < index.count; t += 3) {
    for (let k = 0; k < 3; k++) expect(radius(index.getX(t + k))).toBeGreaterThanOrEqual(CASE_RING_FROM)
  }
  // It is a real part of the case (hundreds of triangles), not all of it, and it reaches the case's outer edge, 16 cm from the axis.
  expect(index.count / 3).toBeGreaterThan(300)
  expect(index.count).toBeLessThan(source.getIndex()!.count)
  const used = [...new Set(Array.from({ length: index.count }, (_, i) => index.getX(i)))]
  expect(Math.max(...used.map(radius))).toBeCloseTo(0.16, 3)
  // It goes from the back of the clock to its front, so that the hull shows all round the silhouette.
  expect(Math.min(...used.map((i) => position.getZ(i)))).toBeCloseTo(0, 3)
  expect(Math.max(...used.map((i) => position.getZ(i)))).toBeGreaterThan(0.03)
  // Its vertices are the case's own (same positions), so the outline lands on the case and needs no placing of its own.
  expect(position).toBe(source.getAttribute('position'))
})
