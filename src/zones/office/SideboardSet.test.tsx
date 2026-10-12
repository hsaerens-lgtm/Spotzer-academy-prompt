import { act, createRoot, extend } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { Group, type Object3D } from 'three'
import { SoftwareRendererContext } from '../../app/quality'
import { layout } from './layout'
import { SideboardSet } from './SideboardSet'

// The cabinets are GLB models and the lamp waits for the texture sets: stand-in groups that record what they draw.
vi.mock('../../three/objects', () => ({
  SceneObject: ({ object, ...props }: { object: string; name?: string }) => <group userData={{ object }} {...props} />,
}))

// The JSX elements these tests mount (<Canvas> registers all of three in the app), and React's act() environment.
extend({ Group })
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// R3F 9.8 builds each root's clock with THREE.Clock, which three r183 deprecated: drop that one notice, keep the rest.
beforeAll(() => {
  const warn = console.warn.bind(console)
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('THREE.Clock: This module has been deprecated')) return
    warn(...args)
  })
})
afterAll(() => {
  vi.restoreAllMocks()
})

const unmounts: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount()
})

/** Mounts `element` in an R3F root with a stand-in renderer (jsdom has no WebGL) and returns its scene. */
async function mount(element: ReactNode, software = false): Promise<Object3D> {
  const canvas = document.createElement('canvas')
  const gl = { render: () => {}, setSize: () => {}, setPixelRatio: () => {}, domElement: canvas, shadowMap: {} }
  const root = createRoot(canvas)
  let scene: Object3D | undefined
  await act(async () => {
    await root.configure({
      gl: gl as never,
      frameloop: 'never',
      size: { width: 160, height: 90, top: 0, left: 0 },
      events: undefined,
      onCreated: (state) => {
        scene = state.scene
      },
    })
    root.render(<SoftwareRendererContext.Provider value={software}>{element}</SoftwareRendererContext.Provider>)
  })
  unmounts.push(() => act(async () => root.unmount()))
  if (!scene) throw new Error('the R3F root was not created')
  return scene
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
