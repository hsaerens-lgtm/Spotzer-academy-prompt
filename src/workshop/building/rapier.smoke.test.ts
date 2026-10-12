// @vitest-environment node
import RAPIER from '@dimforge/rapier3d-compat'

test('the physics engine runs headless under Vitest', async () => {
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0))
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body)
  for (let i = 0; i < 30; i++) world.step()
  expect(body.translation().y).toBeLessThan(5)
  world.free()
})
