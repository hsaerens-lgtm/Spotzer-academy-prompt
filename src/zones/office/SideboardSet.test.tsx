import { extend } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { Group, type Object3D } from 'three'
import { SoftwareRendererContext } from '../../app/quality'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../../test/r3fRoot'
import { layout } from './layout'
import { SideboardSet } from './SideboardSet'

// The cabinets are GLB models and the lamp waits for the texture sets: stand-in groups that record what they draw.
vi.mock('../../three/objects', () => ({
  SceneObject: ({ object, ...props }: { object: string; name?: string }) => <group userData={{ object }} {...props} />,
}))

// The JSX elements these tests mount (<Canvas> registers all of three in the app).
extend({ Group })

beforeAll(() => {
  ignoreClockDeprecation()
})
afterAll(() => {
  vi.restoreAllMocks()
})

const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
})

/** Mounts `element` in an R3F root with a stand-in renderer (src/test/r3fRoot.tsx) and returns its scene. */
async function mount(element: ReactNode, software = false): Promise<Object3D> {
  const root = await mountR3F(<SoftwareRendererContext.Provider value={software}>{element}</SoftwareRendererContext.Provider>)
  roots.push(root)
  return root.state.scene
}

function named(scene: Object3D, name: string): Object3D {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object
}

test('two cabinet models side by side carry the lamp on the right one', async () => {
  const scene = await mount(<SideboardSet />)
  const sideboard = named(scene, 'sideboard')
  expect(sideboard.position.toArray()).toEqual(layout.objects.sideboard.position)
  expect(sideboard.children.map((unit) => [unit.userData.object, unit.position.x])).toEqual([
    ['sideboard', -1.22],
    ['sideboard', 1.22],
  ])
  const lamp = named(scene, 'lamp')
  expect(lamp.userData.object).toBe('lamp')
  expect(lamp.position.toArray()).toEqual(layout.objects.lamp.position)
  expect([sideboard.visible, lamp.visible]).toEqual([true, true])
})

test('without a GPU the cabinets stay hidden with their lamp: the costliest triangles of a software frame', async () => {
  const scene = await mount(<SideboardSet />, true)
  expect(named(scene, 'sideboard').visible).toBe(false)
  expect(named(scene, 'lamp').visible).toBe(false)
})
