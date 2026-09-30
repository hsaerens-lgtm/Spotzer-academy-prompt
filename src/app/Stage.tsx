import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useReducer } from 'react'
import { appStore, useApp } from '../core/store'
import { OfficeScene } from '../zones/office/OfficeScene'
import { isTuneEnabled } from '../zones/office/tune'
import { INITIAL_QUALITY, QualityContext, dprFor, reduceQuality } from './quality'
import { SceneReadySignal } from './SceneReadySignal'
import { TestApiBridge } from './TestApiBridge'
import { onContextLost } from './webgl'

const TuneMode = import.meta.env.DEV ? lazy(() => import('../zones/office/TuneMode')) : null
const tuneEnabled = isTuneEnabled(window.location.search, import.meta.env.DEV)

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  const [quality, dispatchQuality] = useReducer(reduceQuality, INITIAL_QUALITY)
  return (
    <div className="stage" data-testid="stage">
      <Canvas
        shadows="percentage"
        dpr={dprFor(quality.level)}
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
          onDecline={() => dispatchQuality('decline')}
          onIncline={() => dispatchQuality('incline')}
        >
          <QualityContext.Provider value={quality.level}>
            <SceneReadySignal />
            {import.meta.env.DEV && <TestApiBridge />}
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
