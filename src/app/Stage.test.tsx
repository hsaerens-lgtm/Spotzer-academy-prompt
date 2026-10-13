import { act, render } from '@testing-library/react'
import { Children, isValidElement, Suspense, type ReactNode } from 'react'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { preloadBaseAssets } from '../zones/office/baseAssets'
import { OfficeScene } from '../zones/office/OfficeScene'
import { App } from './App'
import { createRenderer } from './renderer'
import { Stage } from './Stage'
import { TransitionMount } from './TransitionMount'

/*
 * The 3D stage leaves the page in reading mode, or when WebGL is lost. A new canvas compiles every shader again: the
 * loading stages start over with it, so the loading screen covers the office while it compiles, instead of the empty
 * background of a hidden base (Task 12).
 */

// jsdom has no WebGL: the canvas is a plain element here, and nothing mounts inside it. It keeps its last props.
const canvas = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: (props: Record<string, unknown>) => {
    canvas.props = props
    return <canvas data-testid="canvas" />
  },
}))
vi.mock('../zones/office/baseAssets', () => ({ preloadBaseAssets: vi.fn(), useBaseModels: vi.fn() }))

beforeEach(() => resetAppStore({ sceneReady: true, decorReady: true }))
afterEach(() => {
  vi.clearAllMocks()
})

// Task 16b: the base downloads start with the stage, all at once (baseAssets.ts).
test('the stage starts every base download when it mounts, once', () => {
  const { rerender } = render(<Stage />)
  expect(preloadBaseAssets).toHaveBeenCalledTimes(1)
  rerender(<Stage />)
  expect(preloadBaseAssets).toHaveBeenCalledTimes(1)
})

// Task 16b: the renderer starts compiling the environment's PMREM program as soon as it exists (renderer.ts).
test('the stage builds its renderer with createRenderer', () => {
  render(<Stage />)
  expect(canvas.props?.gl).toBe(createRenderer)
})

/** The chain of element types from `node` down to the first element of type `target`, or null. */
function pathTo(node: ReactNode, target: unknown): unknown[] | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue
    if (child.type === target) return [child.type]
    const below = pathTo(child.props.children, target)
    if (below) return [child.type, ...below]
  }
  return null
}

// Task 16b: if the office suspends at its first render (a model still parsing), React keeps the empty canvas instead of
// committing a fallback, which it would then hold for 300 ms: the office mounts in a transition, in a revealed boundary.
test('the office mounts in a transition, inside its Suspense boundary', () => {
  render(<Stage />)
  const path = pathTo(canvas.props?.children as ReactNode, OfficeScene)!
  expect(path.slice(-3)).toEqual([Suspense, TransitionMount, OfficeScene])
})

test('the stage resets both loading stages when it leaves the page, not when it arrives', () => {
  const { unmount } = render(<Stage />)
  expect(appStore.getState()).toMatchObject({ sceneReady: true, decorReady: true })
  unmount()
  expect(appStore.getState()).toMatchObject({ sceneReady: false, decorReady: false })
})

test('back from reading mode, the loading screen covers the office until its new canvas is ready', () => {
  const { container } = render(<App />)
  const loading = () => container.querySelector('.loading')
  expect(container.querySelector('.stage')).not.toBeNull()
  expect(loading()).toBeNull()
  act(() => appStore.getState().setReadingMode(true))
  expect(container.querySelector('.stage')).toBeNull()
  act(() => appStore.getState().setReadingMode(false))
  expect(container.querySelector('.stage')).not.toBeNull()
  expect(loading()).not.toBeNull()
  // The new canvas's SceneReadySignal sets it once the office is compiled and drawn.
  act(() => appStore.getState().setSceneReady(true))
  expect(loading()).toBeNull()
})
