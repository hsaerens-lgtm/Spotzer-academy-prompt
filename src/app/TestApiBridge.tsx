import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Box3, Vector3 } from 'three'

export function TestApiBridge() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useEffect(() => {
    const api = window.__academy
    if (!api) return
    api.screenPosition = (name) => {
      const object = scene.getObjectByName(name)
      if (!object) return null
      const centre = new Box3().setFromObject(object).getCenter(new Vector3()).project(camera)
      return { x: ((centre.x + 1) / 2) * size.width, y: ((1 - centre.y) / 2) * size.height }
    }
    return () => {
      delete api.screenPosition
    }
  }, [scene, camera, size])

  return null
}
