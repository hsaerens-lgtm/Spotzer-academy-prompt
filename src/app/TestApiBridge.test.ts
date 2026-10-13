import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene } from 'three'
import { auditScene } from './TestApiBridge'

function scene(...groups: string[]) {
  const root = new Scene()
  for (const name of groups) {
    const group = new Group()
    group.name = name
    root.add(group)
  }
  return root
}

test('the audit reports a missing stage group instead of passing on nothing', () => {
  expect(auditScene(scene('base', 'decor'))).toEqual([])
  expect(auditScene(scene('base'))).toEqual(['decor: group missing'])
  expect(auditScene(scene())).toEqual(['base: group missing', 'decor: group missing'])
})

test('the audit still lists the untextured meshes of the stage groups', () => {
  const root = scene('base', 'decor')
  const plate = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'flat' }))
  plate.name = 'plate'
  root.getObjectByName('base')!.add(plate)
  expect(auditScene(root)).toHaveLength(1)
  expect(auditScene(root)[0]).toContain('plate')
})
