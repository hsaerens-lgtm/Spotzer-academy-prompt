import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useReducer, useState } from 'react'
import { appStore, useApp } from '../core/store'
import { CAMERA, layout } from '../zones/office/layout'
import { OfficeScene } from '../zones/office/OfficeScene'
import { isTuneEnabled } from '../zones/office/tune'
import {
  INITIAL_QUALITY,
  QUALITY_SETTINGS,
  QualityContext,
  SOFTWARE_DPR,
  SoftwareRendererContext,
  isSoftwareRenderer,
  reduceQuality,
  rendererName,
} from './quality'
import { SceneReadySignal } from './SceneReadySignal'
import { TestApiBridge } from './TestApiBridge'
import { onContextLost } from './webgl'

const TuneMode = import.meta.env.DEV ? lazy(() => import('../zones/office/TuneMode')) : null
const tuneEnabled = isTuneEnabled(window.location.search, import.meta.env.DEV)

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  const [quality, dispatchQuality] = useReducer(reduceQuality, INITIAL_QUALITY)
  const [software, setSoftware] = useState(false)
  return (
    <div className="stage" data-testid="stage" data-quality={quality.level}>
      <Canvas
        shadows="percentage"
        dpr={software ? SOFTWARE_DPR : QUALITY_SETTINGS[quality.level].dpr}
        frameloop={active ? 'always' : 'demand'}
        camera={{ ...CAMERA, position: layout.rail[0].position }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          // Without a GPU (the e2e browser), the low tier at SOFTWARE_DPR keeps the office usable.
          if (isSoftwareRenderer(rendererName(gl.getContext()))) {
            setSoftware(true)
            dispatchQuality('software')
          }
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
            <SoftwareRendererContext.Provider value={software}>
              {import.meta.env.DEV && <TestApiBridge />}
              <Suspense fallback={null}>
                <OfficeScene />
                {/* Inside the boundary, after the scene: while the scene suspends (textures, models), the loading screen stays. */}
                <SceneReadySignal />
              </Suspense>
              {TuneMode && tuneEnabled && (
                <Suspense fallback={null}>
                  <TuneMode />
                </Suspense>
              )}
            </SoftwareRendererContext.Provider>
          </QualityContext.Provider>
        </PerformanceMonitor>
      </Canvas>
    </div>
  )
}
