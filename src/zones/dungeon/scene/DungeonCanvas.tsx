import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { brand } from '../../../core/brand'
import { DungeonStoreProvider, type DungeonState } from '../store'
import { CameraRig } from './CameraRig'
import { Guardians } from './Guardians'
import { Maze } from './Maze'

export interface DungeonCanvasProps {
  store: StoreApi<DungeonState>
  onContextLost: () => void
}

/** The dungeon's own canvas (spec 3, §4.4): no shadows, no antialiasing, DPR capped at 1. The office canvas is paused. */
export default function DungeonCanvas({ store, onContextLost }: DungeonCanvasProps) {
  return (
    <Canvas
      className="dg-canvas"
      dpr={1}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 70, near: 0.05, far: 30, position: [0, 0.5, 0] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', onContextLost, { once: true })
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
        </Suspense>
      </DungeonStoreProvider>
    </Canvas>
  )
}
