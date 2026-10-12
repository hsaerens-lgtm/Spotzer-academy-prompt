import { act, createRoot, extend, type RootState } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { DataTexture, Fog, Group, type Material, type Mesh, type Object3D, type Points, type ShaderMaterial, type Texture } from 'three'
import { QualityContext, SoftwareRendererContext, type Quality } from '../../../app/quality'
import { appStore } from '../../../core/store'
import { untexturedMeshes } from '../../../three/audit'
import { applyLighting } from '../lighting/live'
import { PRESETS } from '../lighting/presets'
import { City } from './City'
import { OUTDOOR } from './cityPlan'
import { Outdoor } from './Outdoor'
import { Park } from './Park'
import { Sky } from './Sky'

// jsdom has no 2D canvas: the painted textures become 1 x 1 data textures.
vi.mock('./resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./resources')>()),
  canvasTexture: () => new DataTexture(new Uint8Array(4), 1, 1),
}))

// The JSX elements these tests mount (<Canvas> registers all of three in the app), and React's act() environment.
extend({ Group, Fog })
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

const mounted: (() => Promise<void>)[] = []

/** Mounts `element` in an R3F root with a stand-in renderer (jsdom has no WebGL). Frames run only through `frame`. */
async function mount(element: ReactNode, { quality = 'high' as Quality, software = false } = {}) {
  const canvas = document.createElement('canvas')
  const gl = { render: () => {}, setSize: () => {}, setPixelRatio: () => {}, domElement: canvas, shadowMap: {} }
  const root = createRoot(canvas)
  let state: RootState | undefined
  await act(async () => {
    await root.configure({
      gl: gl as never,
      frameloop: 'never',
      size: { width: 160, height: 90, top: 0, left: 0 },
      events: undefined,
      onCreated: (created) => {
        state = created
      },
    })
    root.render(
      <QualityContext.Provider value={quality}>
        <SoftwareRendererContext.Provider value={software}>{element}</SoftwareRendererContext.Provider>
      </QualityContext.Provider>,
    )
  })
  if (!state) throw new Error('the R3F root was not created')
  const created = state
  let done = false
  const unmount = async () => {
    if (done) return
    done = true
    await act(async () => root.unmount())
  }
  mounted.push(unmount)
  return {
    scene: created.scene,
    /** Runs one frame at `seconds` of elapsed time. */
    frame: (seconds: number) => act(async () => created.advance(seconds)),
    unmount,
  }
}

const named = <T extends Object3D>(scene: Object3D, name: string) => {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object as T
}
const uniforms = (scene: Object3D, name: string) => (named<Mesh | Points>(scene, name).material as ShaderMaterial).uniforms

afterEach(async () => {
  for (const unmount of mounted.splice(0)) await unmount()
  appStore.setState({ reducedMotion: false })
})

test('the outdoor is the sky for the material audit: sky, clouds, birds, city and park', async () => {
  const { scene } = await mount(<Outdoor />)
  const outdoor = named(scene, 'outdoor')
  expect(outdoor.position.x).toBe(OUTDOOR.originX)
  expect(outdoor.children.map((child) => child.name)).toEqual(['sky', 'clouds', 'birds', 'city', 'park'])
  expect(outdoor.userData.auditExempt).toBe('sky')
  expect(untexturedMeshes(scene)).toEqual([])
  // Without the mark, its shader-drawn facades and untextured meshes would be reported.
  delete outdoor.userData.auditExempt
  expect(untexturedMeshes(scene)).toContain('outdoor/city/buildings#ShaderMaterial')
})

test('the scene fog takes the horizon colour of the phase, the range of the facades', async () => {
  const { scene } = await mount(
    <>
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
      <Outdoor />
    </>,
  )
  const fog = scene.fog as Fog
  expect(fog).toBeInstanceOf(Fog)
  const facade = uniforms(scene, 'buildings')
  expect([fog.near, fog.far]).toEqual([facade.uFogNear.value, facade.uFogFar.value])
  applyLighting(PRESETS.night, 0)
  expect(fog.color.equals(PRESETS.night.skyHorizon)).toBe(true)
  expect(facade.uFogColor.value.equals(PRESETS.night.skyHorizon)).toBe(true)
})

test('the city windows keep their own clock on the high and medium tiers, and freeze on low', async () => {
  for (const [quality, windows] of [
    ['high', 12],
    ['medium', 12],
    ['low', 0],
  ] as const) {
    const { scene, frame, unmount } = await mount(<City />, { quality })
    await frame(12)
    expect(uniforms(scene, 'buildings').uTime.value, quality).toBe(windows)
    // The tower beacons still blink on every tier.
    expect(uniforms(scene, 'beacons').uTime.value, quality).toBe(12)
    await unmount()
  }
})

test('reduced motion stills the stars, the window clocks, the beacons and the clouds, and hides the birds', async () => {
  appStore.setState({ reducedMotion: true })
  const { scene, frame } = await mount(<Outdoor />)
  const clouds = () => named(scene, 'clouds').children.map((cloud) => cloud.position.z)
  const drift = clouds()
  applyLighting(PRESETS.day, 0)
  await frame(12)
  expect(uniforms(scene, 'sky').uTime.value).toBe(0)
  expect(uniforms(scene, 'buildings').uTime.value).toBe(0)
  expect(uniforms(scene, 'beacons').uTime.value).toBe(0)
  expect(clouds()).toEqual(drift)
  expect(named(scene, 'birds').visible).toBe(false)

  appStore.setState({ reducedMotion: false })
  applyLighting(PRESETS.day, 0)
  await frame(13)
  expect(uniforms(scene, 'sky').uTime.value).toBe(13)
  expect(uniforms(scene, 'buildings').uTime.value).toBe(13)
  expect(uniforms(scene, 'beacons').uTime.value).toBe(13)
  expect(clouds()).not.toEqual(drift)
  expect(named(scene, 'birds').visible).toBe(true)
})

test('the dome is drawn after the opaque objects, so the depth test discards the sky behind them', async () => {
  const { scene } = await mount(<Sky />)
  const sky = named<Mesh>(scene, 'sky')
  const material = sky.material as ShaderMaterial
  // Opaque objects keep renderOrder 0; transparent ones (glazing, clouds) are drawn after every opaque one anyway.
  expect(sky.renderOrder).toBeGreaterThan(0)
  expect(material.transparent).toBe(false)
  expect(material.depthTest).toBe(true)
  expect(material.depthWrite).toBe(false)
})

test('without a GPU the park stays hidden, lawn and trees: the costliest pixels of a software frame', async () => {
  const gpu = await mount(<Park />)
  expect(named(gpu.scene, 'park').visible).toBe(true)
  const software = await mount(<Park />, { software: true })
  expect(named(software.scene, 'park').visible).toBe(false)
})

test('unmounting the outdoor frees its GPU resources, the instance buffers included', async () => {
  const { scene, unmount } = await mount(<Outdoor />)
  type Disposable = { addEventListener: (type: 'dispose', listener: () => void) => void }
  const resources = new Map<Disposable, string>()
  named(scene, 'outdoor').traverse((object) => {
    const mesh = object as Partial<Mesh> & { isInstancedMesh?: boolean }
    const at = object.name || object.parent?.name || object.type
    if (mesh.isInstancedMesh) resources.set(object as unknown as Disposable, `${at} instances`)
    if (mesh.geometry) resources.set(mesh.geometry as unknown as Disposable, `${at} geometry`)
    for (const material of [mesh.material ?? []].flat() as Material[]) {
      resources.set(material as unknown as Disposable, `${at} material`)
      const map = (material as Material & { map?: Texture | null }).map
      if (map) resources.set(map as unknown as Disposable, `${at} map`)
    }
  })
  expect([...resources.values()].filter((label) => label.endsWith('instances')).length).toBeGreaterThan(0)
  const disposed = new Set<Disposable>()
  for (const resource of resources.keys()) resource.addEventListener('dispose', () => disposed.add(resource))
  await unmount()
  expect([...resources].filter(([resource]) => !disposed.has(resource)).map(([, label]) => label)).toEqual([])
})
