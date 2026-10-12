import { extend } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { Group, Mesh, type Object3D } from 'three'
import { SoftwareRendererContext } from '../../../app/quality'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../../test/r3fRoot'
import { layout } from '../layout'
import { Vases, vasePlantPosition } from './Vases'

// The vases are GLB models: stand-in groups that record which one they draw.
vi.mock('../../../three/objects', () => ({
  SceneObject: ({ object, ...props }: { object: string; name?: string }) => <group userData={{ object }} {...props} />,
}))

extend({ Group, Mesh })

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) throw new Error(`unexpected warning: ${String(args[0])}`)
  })
})
const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  vi.restoreAllMocks()
})
async function mount(element: ReactNode): Promise<Object3D> {
  const root = await mountR3F(element)
  roots.push(root)
  return root.state.scene
}

function named(scene: Object3D, name: string): Object3D {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object
}

/** Drawn only when it and every group above it is visible, as three culls a hidden branch. */
function isShown(object: Object3D): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) if (!node.visible) return false
  return true
}

const TALL = layout.objects.vases.findIndex((vase) => vase.model === 'vaseTall')
const ROUND = layout.objects.vases.findIndex((vase) => vase.model === 'vaseRound')

test('each vase stands at its layout place, its plant at its rim', async () => {
  const scene = await mount(<Vases animate={false} />)
  layout.objects.vases.forEach((vase, index) => {
    const model = named(scene, `vase-${index}`)
    expect(model.userData.object).toBe(vase.model)
    expect(model.position.toArray()).toEqual(vase.position)
    expect(named(scene, `vasePlant-${index}`).position.toArray()).toEqual(vasePlantPosition(vase))
    expect([isShown(model), isShown(named(scene, `vasePlant-${index}`))]).toEqual([true, true])
  })
})

// The tall vase stands on the sideboard (SideboardSet hides the cabinets without a GPU): left on its own it would float.
test('without a GPU the vase on the sideboard goes with it, its pothos too, and the banquette vase stays', async () => {
  const scene = await mount(
    <SoftwareRendererContext.Provider value>
      <Vases animate={false} />
    </SoftwareRendererContext.Provider>,
  )
  expect([isShown(named(scene, `vase-${TALL}`)), isShown(named(scene, `vasePlant-${TALL}`))]).toEqual([false, false])
  expect([isShown(named(scene, `vase-${ROUND}`)), isShown(named(scene, `vasePlant-${ROUND}`))]).toEqual([true, true])
})
