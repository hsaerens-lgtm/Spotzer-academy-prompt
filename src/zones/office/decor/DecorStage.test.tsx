import { extend } from '@react-three/fiber'
import { use } from 'react'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, type Object3D } from 'three'
import { appStore } from '../../../core/store'
import { isClockDeprecation, mountR3F, type TestRoot } from '../../../test/r3fRoot'
import { resetAppStore } from '../../../test/resetAppStore'
import { ENV_MAP_INTENSITY } from '../../../three/materials'
import { PhaseDriver } from '../lighting/PhaseDriver'
import { PRESETS } from '../lighting/presets'
import { DecorStage } from './DecorStage'

/*
 * The second loading stage (spec section 7): the decor loads in its own Suspense boundary while the office shows, stays
 * hidden until its shaders are compiled against the live scene, then shows and sets decorReady; its materials then get
 * the environment at their ratio (the Task 4 ruling), as the base's do.
 */

extend({ Group, Mesh })

let warnings: unknown[][]
beforeEach(() => {
  resetAppStore({ phase: 'day' })
  warnings = []
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) warnings.push(args)
  })
})
const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  vi.restoreAllMocks()
})

async function mount(...args: Parameters<typeof mountR3F>): Promise<TestRoot> {
  const root = await mountR3F(...args)
  roots.push(root)
  return root
}

/** A promise with its resolve and reject at hand. */
function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function named(scene: Object3D, name: string): Object3D {
  const object = scene.getObjectByName(name)
  if (!object) throw new Error(`no object named ${name}`)
  return object
}

const box = new BoxGeometry()

test('the decor stays hidden until its shaders are compiled against the scene, then shows and sets decorReady', async () => {
  const compile = deferred()
  const compileAsync = vi.fn(() => compile.promise)
  const { state } = await mount(
    <DecorStage>
      <mesh name="poster" geometry={box} />
    </DecorStage>,
    { compileAsync },
  )
  const decor = named(state.scene, 'decor')
  expect(named(state.scene, 'poster').parent).toBe(decor)
  expect(decor.visible).toBe(false)
  // Compiled with the scene's lights and environment, which live outside the group.
  await vi.waitFor(() => expect(compileAsync).toHaveBeenCalledWith(decor, state.camera, state.scene))
  expect(appStore.getState().decorReady).toBe(false)
  compile.resolve()
  await vi.waitFor(() => expect(appStore.getState().decorReady).toBe(true))
  expect(decor.visible).toBe(true)
  expect(warnings).toEqual([])
})

test('a failed compilation still shows the decor', async () => {
  const failure = new Error('program not valid')
  const { state } = await mount(
    <DecorStage>
      <mesh name="poster" geometry={box} />
    </DecorStage>,
    { compileAsync: () => Promise.reject(failure) },
  )
  await vi.waitFor(() => expect(appStore.getState().decorReady).toBe(true))
  expect(named(state.scene, 'decor').visible).toBe(true)
  expect(warnings).toEqual([['Decor shaders did not compile ahead of time.', failure]])
})

const pending = new Promise<never>(() => {})
function StillLoading(): null {
  use(pending)
  return null
}

test('the office shows while the decor loads: the decor has its own Suspense boundary', async () => {
  const { state } = await mount(
    <>
      <mesh name="table" geometry={box} />
      <DecorStage>
        <mesh name="poster" geometry={box} />
        <StillLoading />
      </DecorStage>
    </>,
    { compileAsync: () => Promise.resolve() },
  )
  expect(state.scene.getObjectByName('table')).toBeDefined()
  expect(state.scene.getObjectByName('decor')).toBeUndefined()
  expect(state.scene.getObjectByName('poster')).toBeUndefined()
  expect(appStore.getState().decorReady).toBe(false)
})

// Task 4 ruling, carried by Task 12: the environment applier only reaches the materials it has collected; the decor's
// arrive after the first collection, and the decor becoming ready collects them again.
test('decor materials get the environment at their ratio once the decor is ready', async () => {
  const environment = new Texture()
  const surface = new MeshStandardMaterial({ envMapIntensity: ENV_MAP_INTENSITY.surface })
  const base = (
    <>
      <PhaseDriver />
      <mesh name="table" geometry={box} material={surface} />
    </>
  )
  const compile = deferred()
  const root = await mount(base, { compileAsync: () => compile.promise })
  root.state.scene.environment = environment
  await root.frame()
  expect(surface.envMap).toBe(environment)
  // The decor mounts after the first image, with a model material at its own ratio.
  const model = new MeshStandardMaterial({ envMapIntensity: ENV_MAP_INTENSITY.model })
  await root.render(
    <>
      {base}
      <DecorStage>
        <mesh name="poster" geometry={box} material={model} />
      </DecorStage>
    </>,
  )
  await root.frame()
  expect(model.envMap).toBeNull()
  compile.resolve()
  await vi.waitFor(() => expect(appStore.getState().decorReady).toBe(true))
  await root.frame()
  expect(model.envMap).toBe(environment)
  expect(model.envMapIntensity).toBeCloseTo(ENV_MAP_INTENSITY.model * PRESETS.day.environment)
  expect(surface.envMapIntensity).toBeCloseTo(ENV_MAP_INTENSITY.surface * PRESETS.day.environment)
})
