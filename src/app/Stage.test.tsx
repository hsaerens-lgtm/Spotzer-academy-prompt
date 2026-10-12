import { act, render } from '@testing-library/react'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { App } from './App'
import { Stage } from './Stage'

/*
 * The 3D stage leaves the page in reading mode, or when WebGL is lost. A new canvas compiles every shader again: the
 * loading stages start over with it, so the loading screen covers the office while it compiles, instead of the empty
 * background of a hidden base (Task 12).
 */

// jsdom has no WebGL: the canvas is a plain element here, and nothing mounts inside it.
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: () => <canvas data-testid="canvas" />,
}))

beforeEach(() => resetAppStore({ sceneReady: true, decorReady: true }))

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
