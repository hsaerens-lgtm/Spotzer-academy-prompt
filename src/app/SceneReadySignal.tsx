import { useFrame } from '@react-three/fiber'
import { appStore } from '../core/store'

/** Flags the scene as ready once the first frame has rendered. */
export function SceneReadySignal() {
  useFrame(() => {
    const state = appStore.getState()
    if (!state.sceneReady) state.setSceneReady(true)
  })
  return null
}
