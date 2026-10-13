import { act, extend } from '@react-three/fiber'
import { Suspense } from 'react'
import { DirectionalLight, HemisphereLight, PointLight, RectAreaLight, SpotLight, type Light, type Object3D } from 'three'
import { QUALITY_SETTINGS, type Quality } from '../../../app/quality'
import { CLOCK_MINUTES, PHASES } from '../../../core/phase'
import { ignoreClockDeprecation, mountR3F, type TestRoot } from '../../../test/r3fRoot'
import { applyLighting } from './live'
import { Lights } from './Lights'
import { PRESETS } from './presets'
import { rigLights, type RigLightKind } from './rig'

/*
 * The light rig as Lights.tsx mounts it, on each quality tier: every light rigLights() names is in the scene, of the
 * kind it declares, and nothing else is; the list stays the same through the phases (a light a phase turns off stays
 * mounted at intensity 0: a change in the number of lights would recompile every material).
 */

// The JSX elements the rig mounts (<Canvas> registers all of three in the app).
extend({ DirectionalLight, HemisphereLight, PointLight, RectAreaLight, SpotLight })

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

const IS_KIND: Record<RigLightKind, (light: Light) => boolean> = {
  directional: (light) => (light as DirectionalLight).isDirectionalLight === true,
  hemisphere: (light) => (light as HemisphereLight).isHemisphereLight === true,
  rectArea: (light) => (light as RectAreaLight).isRectAreaLight === true,
  spot: (light) => (light as SpotLight).isSpotLight === true,
  point: (light) => (light as PointLight).isPointLight === true,
}

function lightsOf(scene: Object3D): Light[] {
  const found: Light[] = []
  scene.traverse((object) => {
    if ((object as Light).isLight) found.push(object as Light)
  })
  return found
}

/** Mounts the rig of a tier and waits for it: it suspends until the area light tables are built. */
async function mountRig(quality: Quality) {
  const root = await mountR3F(
    <Suspense fallback={null}>
      <Lights settings={QUALITY_SETTINGS[quality]} />
    </Suspense>,
  )
  roots.push(root)
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!root.state.scene.getObjectByName('sun')) throw new Error('the rig has not mounted')
  })
  return root
}

const TIERS: Quality[] = ['high', 'medium', 'low']

test('each tier mounts every light of its rig, of the kind the rig declares, and no other', async () => {
  for (const quality of TIERS) {
    const { state } = await mountRig(quality)
    const expected = rigLights(QUALITY_SETTINGS[quality])
    const lights = lightsOf(state.scene)
    expect(lights.map((light) => light.name), quality).toEqual(expected.map(({ name }) => name))
    for (const { name, kind } of expected) {
      const light = state.scene.getObjectByName(name) as Light
      expect(IS_KIND[kind](light), `${quality}: ${name} is a ${kind} light`).toBe(true)
    }
  }
})

test('only the sun casts shadows, and only on a tier with a shadow map', async () => {
  for (const quality of TIERS) {
    const { state } = await mountRig(quality)
    const casters = lightsOf(state.scene).filter((light) => light.castShadow)
    expect(casters.map((light) => light.name), quality).toEqual(QUALITY_SETTINGS[quality].shadowMapSize > 0 ? ['sun'] : [])
  }
})

test('the lights stay the same through every phase: a light a phase turns off stays mounted', async () => {
  for (const quality of TIERS) {
    const root = await mountRig(quality)
    const expected = rigLights(QUALITY_SETTINGS[quality]).map(({ name }) => name)
    const intensities = new Map<string, number[]>()
    for (const phase of PHASES) {
      applyLighting(PRESETS[phase], CLOCK_MINUTES[phase])
      await root.frame()
      const lights = lightsOf(root.state.scene)
      expect(lights.map((light) => light.name), `${quality}, ${phase}`).toEqual(expected)
      for (const light of lights) intensities.set(light.name, [...(intensities.get(light.name) ?? []), light.intensity])
    }
    // The phases do drive them: the lamp is off by day and on at night, with the same light object in the scene.
    expect(intensities.get('lamp-light')![0], quality).toBe(0)
    expect(intensities.get('lamp-light')![2], quality).toBeGreaterThan(0)
  }
})

// Task 16b: the stage builds the tables before the office renders (baseAssets.ts). The rig must not suspend then: the
// boundary would show its fallback, and React holds a boundary it reveals back until 300 ms after that fallback.
test('once the area light tables are built, the rig mounts without suspending', async () => {
  // Fresh modules: React marks a promise it has read as settled, so the tables promise must be one no rig has used yet.
  vi.resetModules()
  const { areaLightTablesReady } = await import('./areaLights')
  const { Lights } = await import('./Lights')
  await areaLightTablesReady()
  const fallback = vi.fn()
  function Fallback() {
    fallback()
    return null
  }
  const root = await mountR3F(
    <Suspense fallback={<Fallback />}>
      <Lights settings={QUALITY_SETTINGS.high} />
    </Suspense>,
  )
  roots.push(root)
  expect(root.state.scene.getObjectByName('sun')).toBeDefined()
  expect(fallback).not.toHaveBeenCalled()
})
