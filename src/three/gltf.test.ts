import { Box3, BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { cloneModel, meshesOf, normaliseModel, prepareModel, scaleToHeight } from './gltf'
import { ENV_MAP_INTENSITY } from './materials'

/** A loaded-model stand-in: a group holding a 1 x 2 x 0.5 m box away from the origin. */
function model(material = new MeshStandardMaterial({ name: 'wood' })) {
  const root = new Group()
  const box = new Mesh(new BoxGeometry(1, 2, 0.5), material)
  box.position.set(3, 5, -2)
  root.add(box)
  return root
}

const bounds = (root: Group) => new Box3().setFromObject(root)

test('normaliseModel stands a model on the floor, centred', () => {
  const root = model()
  const size = normaliseModel(root)
  expect(size.toArray()).toEqual([1, 2, 0.5])
  const box = bounds(root)
  expect(box.min.y).toBeCloseTo(0)
  const centre = box.getCenter(new Vector3())
  expect(centre.x).toBeCloseTo(0)
  expect(centre.z).toBeCloseTo(0)
})

test('scaleToHeight scales uniformly', () => {
  const root = model()
  scaleToHeight(root, 1)
  expect(root.scale.toArray()).toEqual([0.5, 0.5, 0.5])
  normaliseModel(root)
  const size = bounds(root).getSize(new Vector3())
  expect(size.y).toBeCloseTo(1)
  expect(size.x).toBeCloseTo(0.5)
  expect(size.z).toBeCloseTo(0.25)
  expect(bounds(root).min.y).toBeCloseTo(0)
})

test('prepareModel turns shadows on and marks glass', () => {
  const root = model(new MeshStandardMaterial({ name: 'wall_clock' }))
  const glass = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({ name: 'wall_clock_glass', transparent: true, opacity: 0.4 }))
  root.add(glass)
  prepareModel(root)
  const [body, pane] = meshesOf(root)
  expect([body.castShadow, body.receiveShadow]).toEqual([true, true])
  expect([pane.castShadow, pane.receiveShadow]).toEqual([false, true])
  expect((pane.material as MeshPhysicalMaterial).userData.auditExempt).toBe('glass')
  expect((body.material as MeshStandardMaterial).userData.auditExempt).toBeUndefined()
})

test('prepareModel sets the environment strength once per shared material', () => {
  const shared = new MeshStandardMaterial({ name: 'cabinet' })
  const loaded = model(shared)
  const first = cloneModel(loaded)
  const second = cloneModel(loaded)
  expect(meshesOf(first)[0]).not.toBe(meshesOf(loaded)[0])
  expect(meshesOf(first)[0].material).toBe(shared)
  prepareModel(first)
  expect(shared.envMapIntensity).toBe(ENV_MAP_INTENSITY.model)
  // A later tweak survives the preparation of another copy: each material is prepared once.
  shared.envMapIntensity = 0.3
  prepareModel(second)
  expect(shared.envMapIntensity).toBe(0.3)
  expect(meshesOf(second)[0].castShadow).toBe(true)
})
