import { extend } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { BoxGeometry, DataTexture, Group, Mesh, MeshBasicMaterial } from 'three'
import { appStore } from '../core/store'
import { isClockDeprecation, mountR3F, type TestRoot } from '../test/r3fRoot'
import { resetAppStore } from '../test/resetAppStore'
import { paintLater } from '../three/paintLater'
import { SceneReadySignal } from './SceneReadySignal'

/*
 * The first loading stage (spec section 7): the base stays hidden while every shader of the scene compiles, one warm
 * frame draws it, and only the frame after that sets sceneReady (the loading screen goes away on a compiled image).
 */

extend({ Group, Mesh })

let warnings: unknown[][]
beforeEach(() => {
  resetAppStore()
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

function Base() {
  const base = useRef<Group>(null)
  return (
    <>
      <group name="base" ref={base}>
        <mesh geometry={new BoxGeometry()} />
      </group>
      <SceneReadySignal target={base} />
    </>
  )
}

/** Mounts the base with a stand-in renderer whose compileAsync runs `compile` and whose render() records whether the base was shown. */
async function mount(compile: () => Promise<void>) {
  const drawn: boolean[] = []
  const compileAsync = vi.fn(compile)
  const root = await mountR3F(<Base />, {
    compileAsync,
    render: (scene: Group) => drawn.push(scene.getObjectByName('base')!.visible),
  })
  roots.push(root)
  return { root, compileAsync, drawn, base: root.state.scene.getObjectByName('base')! }
}

test('the base shows once every shader is compiled, and sceneReady waits for one warm frame', async () => {
  let compiled!: () => void
  const done = new Promise<void>((resolve) => (compiled = resolve))
  const { root, compileAsync, drawn, base } = await mount(() => done)
  expect(base.visible).toBe(false)
  // The whole scene, so the lights and the environment (outside the base) are part of the compiled programs.
  await vi.waitFor(() => expect(compileAsync).toHaveBeenCalledWith(root.state.scene, root.state.camera, null))
  await root.frame()
  expect(appStore.getState().sceneReady).toBe(false)
  compiled()
  await vi.waitFor(() => expect(base.visible).toBe(true))
  expect(appStore.getState().sceneReady).toBe(false)
  // The warm frame draws the base before anyone sees it...
  drawn.length = 0
  await root.frame()
  expect(drawn).toEqual([true])
  expect(appStore.getState().sceneReady).toBe(false)
  // ...and the frame after it sets sceneReady.
  await root.frame()
  expect(appStore.getState().sceneReady).toBe(true)
  expect(warnings).toEqual([])
})

test('a failed compilation still shows the office, and says so in development', async () => {
  const failure = new Error('program not valid')
  const { root, base } = await mount(() => Promise.reject(failure))
  await vi.waitFor(() => expect(base.visible).toBe(true))
  await root.frame()
  await root.frame()
  expect(appStore.getState().sceneReady).toBe(true)
  expect(warnings).toEqual([['Office shaders did not compile ahead of time.', failure]])
})

// The stage leaves the page while the office compiles (reading mode, Task 12): nothing of the old canvas may land later.
test('unmounted while the shaders compile, it neither shows the base nor sets sceneReady', async () => {
  let compiled!: () => void
  const done = new Promise<void>((resolve) => (compiled = resolve))
  const { root, compileAsync, base } = await mount(() => done)
  await vi.waitFor(() => expect(compileAsync).toHaveBeenCalled())
  await root.unmount()
  compiled()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(base.visible).toBe(false)
  expect(appStore.getState().sceneReady).toBe(false)
  expect(warnings).toEqual([])
})

// SwiftShader (the e2e browser) and Safari have no KHR_parallel_shader_compile: compileAsync would compile at once
// anyway, after three warns on the console that the extension is missing.
test('without parallel shader compilation, the programs compile at once, with no warning', async () => {
  const compile = vi.fn()
  const compileAsync = vi.fn()
  const has = vi.fn(() => false)
  const root = await mountR3F(<Base />, { compile, compileAsync, extensions: { has } })
  roots.push(root)
  const base = root.state.scene.getObjectByName('base')!
  await vi.waitFor(() => expect(base.visible).toBe(true))
  expect(has).toHaveBeenCalledWith('KHR_parallel_shader_compile')
  expect(compile).toHaveBeenCalledWith(root.state.scene, root.state.camera, null)
  expect(compileAsync).not.toHaveBeenCalled()
  await root.frame()
  await root.frame()
  expect(appStore.getState().sceneReady).toBe(true)
  expect(warnings).toEqual([])
})

// Task 16b: the GPU compiles in parallel while the main thread runs the base's own effects (drei's useTexture uploads
// every texture in one): the programs are queued first, in the commit that mounts the base.
test('the shaders are queued before the effects of the base run', async () => {
  const order: string[] = []
  function Uploads() {
    useEffect(() => {
      order.push('base effect')
    }, [])
    return null
  }
  function BaseWithEffects() {
    const base = useRef<Group>(null)
    return (
      <>
        <group name="base" ref={base}>
          <Uploads />
        </group>
        <SceneReadySignal target={base} />
      </>
    )
  }
  const compileAsync = vi.fn(() => {
    order.push('compile')
    return Promise.resolve()
  })
  roots.push(await mountR3F(<BaseWithEffects />, { compileAsync }))
  expect(order).toEqual(['compile', 'base effect'])
})

// Task 16b: the base's painted canvases (paintLater) wait for its programs, and are painted before the warm frame.
test('the textures the base paints later are painted once its shaders are queued', async () => {
  const order: string[] = []
  const map = paintLater(new DataTexture(new Uint8Array(4), 1, 1), () => order.push('paint'))
  function PaintedBase() {
    const base = useRef<Group>(null)
    return (
      <>
        <group name="base" ref={base}>
          <mesh geometry={new BoxGeometry()} material={new MeshBasicMaterial({ map })} />
        </group>
        <SceneReadySignal target={base} />
      </>
    )
  }
  const compileAsync = vi.fn(() => {
    order.push('compile')
    return Promise.resolve()
  })
  const root = await mountR3F(<PaintedBase />, { compileAsync })
  roots.push(root)
  expect(order).toEqual(['compile', 'paint'])
})
