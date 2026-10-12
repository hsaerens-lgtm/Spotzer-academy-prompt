// @vitest-environment node
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three'
import { MODEL_PARTS } from '../../three/assets'
import { CASE_RING_FROM, caseRing, isClockCase } from './clockCase'

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
const radiusOf = (geometry: BufferGeometry, vertex: number) => {
  const position = geometry.getAttribute('position')
  return Math.hypot(position.getX(vertex), position.getY(vertex))
}

/**
 * The bezel's inner wall, measured on the case mesh: the farthest vertex from the axis of the triangles that face the
 * axis and lie wholly in the front half of the case (the dial's rim and the bezel standing in front of the dial). The
 * back of the case also has a wall facing the axis, the skirt round the hollow behind the dial: it spans the back half.
 */
function bezelInnerWall(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()!
  const at = (vertex: number) => new Vector3().fromBufferAttribute(position, vertex)
  let depth = 0
  for (let v = 0; v < position.count; v++) depth = Math.max(depth, position.getZ(v))
  let wall = 0
  for (let t = 0; t < index.count; t += 3) {
    const [a, b, c] = [at(index.getX(t)), at(index.getX(t + 1)), at(index.getX(t + 2))]
    if (Math.min(a.z, b.z, c.z) < depth / 2) continue
    const normal = new Vector3().subVectors(c, b).cross(new Vector3().subVectors(a, b)).normalize()
    const centre = new Vector3().add(a).add(b).add(c).divideScalar(3).setZ(0).normalize()
    if (normal.dot(centre) < -0.5) wall = Math.max(wall, ...[0, 1, 2].map((k) => radiusOf(geometry, index.getX(t + k))))
  }
  return wall
}
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
  // Every triangle of the ring lies wholly outside CASE_RING_FROM, which sits just outside the bezel's inner wall (below).
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

test('the ring starts just outside the inner wall of the bezel, before the outer shell, both measured on the model', async () => {
  const [body] = (await clockMeshes()).filter(isClockCase)
  const wall = bezelInnerWall(body.geometry)
  // The wall rises from the rim of the dial (14 cm from the axis) to the front of the bezel.
  expect(wall).toBeGreaterThan(0.13)
  expect(CASE_RING_FROM).toBeGreaterThan(wall)
  expect(CASE_RING_FROM - wall).toBeLessThan(0.005)
  // The first vertex out from the wall starts the outer shell: the ring must not cut into it.
  const radii = Array.from({ length: body.geometry.getAttribute('position').count }, (_, v) => radiusOf(body.geometry, v))
  const shell = Math.min(...radii.filter((r) => r > wall))
  expect(CASE_RING_FROM).toBeLessThan(shell)
})

// A model without an index (none in the office) must not throw in the middle of a render: the outline rings the whole
// case. drei's Outlines rewrites the normals of a geometry without an index and disposes it on unhover: a copy, then.
test('a case without an index gets the outline of the whole case, from a copy of its geometry', () => {
  const source = new BufferGeometry()
  source.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0.16, 0, 0, 0, 0.16, 0, 0.1, 0.1, 0.03]), 3))
  source.setAttribute('normal', new BufferAttribute(new Float32Array(12).fill(1), 3))
  const ring = caseRing(source)
  expect(ring).not.toBe(source)
  expect(ring.getIndex()).toBeNull()
  for (const name of ['position', 'normal']) {
    expect(ring.getAttribute(name), name).not.toBe(source.getAttribute(name))
    expect(Array.from(ring.getAttribute(name).array), name).toEqual(Array.from(source.getAttribute(name).array))
  }
})
