import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { isSoftwareRenderer, rendererName } from '../../../app/quality'
import { brand } from '../../../core/brand'
import { DungeonStoreProvider, type DungeonState } from '../store'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { Guardians } from './Guardians'
import { Maze } from './Maze'

export interface DungeonCanvasProps {
  store: StoreApi<DungeonState>
  onContextLost: () => void
}

/** The dungeon's own canvas (spec 3, §4.4): no shadows, no antialiasing, DPR capped at 1. The office canvas is paused. */
export default function DungeonCanvas({ store, onContextLost }: DungeonCanvasProps) {
  // Without a GPU (the e2e browser), only the cheap effects run (spec 3, §4.4).
  const [software, setSoftware] = useState(false)
  // The listener goes with the canvas: the renderer's own disposal loses the context on purpose.
  const element = useRef<HTMLCanvasElement | null>(null)
  const lost = useRef(onContextLost)
  lost.current = onContextLost
  const onLost = useRef(() => lost.current())
  useEffect(() => () => element.current?.removeEventListener('webglcontextlost', onLost.current), [])
  return (
    <Canvas
      className="dg-canvas"
      dpr={1}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 70, near: 0.05, far: 30, position: [0, 0.5, 0] }}
      onCreated={({ gl }) => {
        setSoftware(isSoftwareRenderer(rendererName(gl.getContext())))
        element.current = gl.domElement
        gl.domElement.addEventListener('webglcontextlost', onLost.current, { once: true })
      }}
    >
      {/* The canvas is its own React root: the dungeon store is provided again inside it. */}
      <DungeonStoreProvider value={store}>
        <color attach="background" args={[brand.ink]} />
        <fogExp2 attach="fog" args={[brand.ink, 0.22]} />
        <ambientLight intensity={0.18} />
        <Suspense fallback={null}>
          <Maze />
          <Guardians />
          <CameraRig />
          <Effects software={software} />
        </Suspense>
      </DungeonStoreProvider>
    </Canvas>
  )
}
