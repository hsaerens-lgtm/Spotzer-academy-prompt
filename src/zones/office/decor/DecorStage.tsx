import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { Group } from 'three'
import { appStore } from '../../../core/store'
import { compileAhead } from '../../../three/compile'
import { paintPending } from '../../../three/paintLater'

/**
 * Hides the decor group until its shaders are compiled against the live scene (lights and environment included) and
 * its canvases painted later are painted (paintLater), then shows it and sets decorReady. A failed compilation still
 * shows the decor: a stall beats a missing room.
 */
function DecorReadySignal({ target }: { target: RefObject<Group | null> }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  useLayoutEffect(() => {
    if (target.current) target.current.visible = false
  }, [target])
  useEffect(() => {
    const group = target.current
    if (!group) return
    let cancelled = false
    Promise.resolve()
      .then(() => {
        const compiled = compileAhead(gl, group, camera, scene)
        // While the GPU compiles: the canvases painted later (paintLater), before the decor shows.
        paintPending(group)
        return compiled
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Decor shaders did not compile ahead of time.', error)
      })
      .then(() => {
        if (cancelled) return
        group.visible = true
        if (!appStore.getState().decorReady) appStore.getState().setDecorReady(true)
        invalidate()
      })
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera, invalidate, target])
  return null
}

/**
 * Second loading stage (spec section 7): its own Suspense boundary, so the office shows while the decor loads.
 * Mounted once the base is ready (OfficeScene), so the decor downloads after the first image.
 */
export function DecorStage({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null)
  return (
    <Suspense fallback={null}>
      <group name="decor" ref={group}>
        {children}
      </group>
      <DecorReadySignal target={group} />
    </Suspense>
  )
}
