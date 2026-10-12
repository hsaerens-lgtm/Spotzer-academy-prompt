import { extend } from '@react-three/fiber'
import { useRef } from 'react'
import { BoxGeometry, Group, Mesh } from 'three'
import { appStore } from '../core/store'
import { isClockDeprecation, mountR3F, type TestRoot } from '../test/r3fRoot'
import { resetAppStore } from '../test/resetAppStore'
import { SceneReadySignal } from './SceneReadySignal'

/*
 * The first loading stage (spec section 7): the base stays hidden while every shader of the scene compiles, one warm
 * frame draws it, and only the frame after that sets sceneReady (the loading screen goes away on a compiled image).
 */

extend({ Group, Mesh })

beforeEach(() => {
  resetAppStore()
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) throw new Error(`unexpected warning: ${String(args[0])}`)
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
})

test('a failed compilation still shows the office', async () => {
  const { root, base } = await mount(() => Promise.reject(new Error('program not valid')))
  await vi.waitFor(() => expect(base.visible).toBe(true))
  await root.frame()
  await root.frame()
  expect(appStore.getState().sceneReady).toBe(true)
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
})
