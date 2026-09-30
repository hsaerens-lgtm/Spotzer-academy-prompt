import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useState } from 'react'
import { appStore, useApp } from '../core/store'
import { OfficeScene } from '../zones/office/OfficeScene'
import { isTuneEnabled } from '../zones/office/tune'
import { QualityContext, dprFor, nextQuality, type Quality } from './quality'
import { SceneReadySignal } from './SceneReadySignal'
import { onContextLost } from './webgl'

const TuneMode = import.meta.env.DEV ? lazy(() => import('../zones/office/TuneMode')) : null
const tuneEnabled = isTuneEnabled(window.location.search, import.meta.env.DEV)

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  const [quality, setQuality] = useState<Quality>('high')
  const change = (event: 'decline' | 'incline' | 'fallback') => setQuality((current) => nextQuality(current, event))
  return (
    <div className="stage" data-testid="stage">
      <Canvas
        shadows="percentage"
        dpr={dprFor(quality)}
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
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => change('decline')}
          onIncline={() => change('incline')}
          onFallback={() => change('fallback')}
        >
          <QualityContext.Provider value={quality}>
            <SceneReadySignal />
            <Suspense fallback={null}>
              <OfficeScene />
            </Suspense>
            {TuneMode && tuneEnabled && (
              <Suspense fallback={null}>
                <TuneMode />
              </Suspense>
            )}
          </QualityContext.Provider>
        </PerformanceMonitor>
      </Canvas>
    </div>
  )
}
