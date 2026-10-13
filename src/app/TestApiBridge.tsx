import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Box3, Vector3, type Light, type Object3D } from 'three'
import { appStore } from '../core/store'
import { untexturedMeshes } from '../three/audit'
import type { LightingSnapshot } from './testApi'

/** Scene groups covered by the material audit (spec section 9): the base stage and the decor stage. */
const AUDITED_GROUPS = ['base', 'decor']

/** The material audit of the stage groups. A missing group is reported, so the audit can never pass on nothing. */
export function auditScene(scene: Object3D): string[] {
  return AUDITED_GROUPS.flatMap((name) => {
    const root = scene.getObjectByName(name)
    return root ? untexturedMeshes(root) : [`${name}: group missing`]
  })
}

/** Development only (mounted behind import.meta.env.DEV): adds the canvas-side methods of window.__academy. */
export function TestApiBridge() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const api = window.__academy
    if (!api) return
    api.screenPosition = (name) => {
      const object = scene.getObjectByName(name)
      if (!object) return null
      const centre = new Box3().setFromObject(object).getCenter(new Vector3()).project(camera)
      return { x: ((centre.x + 1) / 2) * size.width, y: ((1 - centre.y) / 2) * size.height }
    }
    api.lighting = (): LightingSnapshot => {
      const light = (name: string) => scene.getObjectByName(name) as Light | undefined
      const sun = light('sun')
      const { phase, phaseTransition } = appStore.getState()
      return {
        phase,
        transitioning: phaseTransition !== null,
        exposure: gl.toneMappingExposure,
        environmentIntensity: scene.environmentIntensity,
        sunIntensity: sun?.intensity ?? Number.NaN,
        sunColor: sun ? `#${sun.color.getHexString()}` : '',
        windowIntensity: light('window-light')?.intensity ?? Number.NaN,
        lampIntensity: light('lamp-light')?.intensity ?? Number.NaN,
      }
    }
    api.untexturedMeshes = () => auditScene(scene)
    return () => {
      delete api.screenPosition
      delete api.lighting
      delete api.untexturedMeshes
    }
  }, [scene, camera, size, gl])

  return null
}
