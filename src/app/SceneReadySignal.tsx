import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { Object3D } from 'three'
import { appStore } from '../core/store'
import { compileAhead } from '../three/compile'

type Stage = 'compiling' | 'warm' | 'ready' | 'done'

/**
 * First loading stage (spec section 7, as in Horn.os): the base group stays hidden while every shader it needs compiles
 * (compileAhead, against the scene's lights and environment, which live outside the group), then one warm frame draws
 * it, and only the frame after that sets sceneReady (the loading screen goes away). A failed compilation still shows the
 * office (a stall beats a missing room), with a warning in development. invalidate() keeps it moving when the canvas
 * renders on demand (another zone on screen).
 * The programs are queued in a layout effect, in the commit that mounts the base, before the base's passive effects
 * (drei's useTexture uploads every texture there): the GPU compiles in parallel while the main thread uploads (Task 16b).
 */
export function SceneReadySignal({ target }: { target: RefObject<Object3D | null> }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const stage = useRef<Stage>('compiling')

  useLayoutEffect(() => {
    if (target.current) target.current.visible = false
  }, [target])

  useLayoutEffect(() => {
    let cancelled = false
    // Queued now; a synchronous failure rejects the promise like a failed compilation.
    new Promise((resolve) => resolve(compileAhead(gl, scene, camera)))
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Office shaders did not compile ahead of time.', error)
      })
      .then(() => {
        if (cancelled) return
        if (target.current) target.current.visible = true
        stage.current = 'warm'
        invalidate()
      })
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera, invalidate, target])

  useFrame(() => {
    if (stage.current === 'warm') {
      // This frame is the warm-up: the base is drawn once before anyone sees it.
      stage.current = 'ready'
      invalidate()
    } else if (stage.current === 'ready') {
      stage.current = 'done'
      if (!appStore.getState().sceneReady) appStore.getState().setSceneReady(true)
    }
  })
  return null
}
