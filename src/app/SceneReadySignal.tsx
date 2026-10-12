import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { Camera, Object3D, Scene, WebGLRenderer } from 'three'
import { appStore } from '../core/store'

type Stage = 'compiling' | 'warm' | 'ready' | 'done'

/**
 * Compiles every program `object` needs, against the lights and environment of `scene` (default: `object` itself), before
 * it is drawn. compileAsync where the browser compiles in parallel (KHR_parallel_shader_compile). Elsewhere (SwiftShader
 * in the e2e browser, Safari) compileAsync compiles at once anyway, after three warns on the console that the extension
 * is missing: compile() does the same work without the warning.
 */
export function compileAhead(gl: WebGLRenderer, object: Object3D, camera: Camera, scene: Scene | null = null): Promise<unknown> {
  if (gl.extensions.has('KHR_parallel_shader_compile')) return gl.compileAsync(object, camera, scene)
  gl.compile(object, camera, scene)
  return Promise.resolve()
}

/**
 * First loading stage (spec section 7, as in Horn.os): the base group stays hidden while every shader it needs compiles
 * (compileAhead, against the scene's lights and environment, which live outside the group), then one warm frame draws
 * it, and only the frame after that sets sceneReady (the loading screen goes away). A failed compilation still shows the
 * office. invalidate() keeps it moving when the canvas renders on demand (another zone on screen).
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

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => compileAhead(gl, scene, camera))
      .catch(() => undefined)
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
