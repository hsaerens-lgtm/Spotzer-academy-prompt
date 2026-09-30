import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { appStore, useApp } from '../core/store'
import { OfficeScene } from '../zones/office/OfficeScene'
import { SceneReadySignal } from './SceneReadySignal'
import { onContextLost } from './webgl'

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  return (
    <div className="stage" data-testid="stage">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'demand'}
        camera={{ fov: 45, near: 0.1, far: 60, position: [1.2, 2.3, 5.6] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            'webglcontextlost',
            onContextLost(gl.domElement, () => appStore.getState().reportWebglLost()),
            { once: true },
          )
        }}
      >
        <SceneReadySignal />
        <Suspense fallback={null}>
          <OfficeScene />
        </Suspense>
      </Canvas>
    </div>
  )
}
