import { act, advance, createRoot, type RootState } from '@react-three/fiber'
import type { ReactNode } from 'react'

// React's act() environment: test roots render through act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** R3F 9.8 builds each root's clock with THREE.Clock, which three r183 deprecated: the notice every test root prints. */
export function isClockDeprecation(args: readonly unknown[]): boolean {
  return typeof args[0] === 'string' && args[0].startsWith('THREE.Clock: This module has been deprecated')
}

export interface TestRoot {
  /** The root's state: its scene, camera and stand-in renderer. */
  state: RootState
  /** Replaces what the root renders. */
  render: (element: ReactNode) => Promise<void>
  /** One frame, as the render loop runs it: every useFrame callback, then the stand-in gl.render(). */
  frame: () => Promise<void>
  unmount: () => Promise<void>
}

/**
 * Mounts `element` in an R3F root with a stand-in renderer (jsdom has no WebGL), on frameloop 'never': frames run only
 * through frame(). `gl` adds to the stand-in or replaces its members (compileAsync, render, extensions...): by default
 * it reports every WebGL extension as supported. Register the JSX elements the test mounts with extend() first
 * (<Canvas> registers all of three in the app).
 */
export async function mountR3F(element: ReactNode, gl: Record<string, unknown> = {}): Promise<TestRoot> {
  const canvas = document.createElement('canvas')
  const standIn = {
    render: () => {},
    setSize: () => {},
    setPixelRatio: () => {},
    extensions: { has: () => true },
    domElement: canvas,
    shadowMap: {},
    ...gl,
  }
  const root = createRoot(canvas)
  let created: RootState | undefined
  await act(async () => {
    await root.configure({
      gl: standIn as never,
      frameloop: 'never',
      size: { width: 160, height: 90, top: 0, left: 0 },
      events: undefined,
      onCreated: (state) => {
        created = state
      },
    })
    root.render(element)
  })
  if (!created) throw new Error('the R3F root was not created')
  const state = created
  let seconds = 0
  return {
    state,
    render: (next) =>
      act(async () => {
        root.render(next)
      }),
    frame: () =>
      act(async () => {
        seconds += 1 / 60
        advance(seconds, true, state)
      }),
    unmount: () =>
      act(async () => {
        root.unmount()
      }),
  }
}
