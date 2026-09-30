import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useScreenRef } from '../../core/selectors'
import { materials } from '../../three/materials'
import { ScreenContent } from '../../visuals/ScreenContent'
import { layout } from './layout'

export const SCREEN_PX = { width: 1280, height: 720 }

/** drei <Html transform> maps 1 CSS pixel to distanceFactor / 400 world units. */
export function screenDistanceFactor(widthMetres: number): number {
  return (widthMetres / SCREEN_PX.width) * 400
}

export function WallScreen3D() {
  const m = materials()
  const screen = useScreenRef()
  // Mounting <Html> during the Canvas's first commit loses its content when drei's portal target settles.
  const connected = useThree((state) => state.events.connected)
  const { position, size } = layout.screen
  return (
    <group position={position} name="screen">
      <mesh position-z={-0.03} material={m.ink} castShadow>
        <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, 0.05]} />
      </mesh>
      <mesh material={m.screenOff}>
        <planeGeometry args={size} />
      </mesh>
      {/* Sits below the DOM overlay (z-index 10) and never catches the pointer. occlude="blending" lets foreground meshes hide it. */}
      {connected && (
        <Html
          transform
          occlude="blending"
          distanceFactor={screenDistanceFactor(size[0])}
          position-z={0.003}
          zIndexRange={[5, 0]}
          pointerEvents="none"
          wrapperClass="wall-screen"
        >
          <ScreenContent screen={screen} />
        </Html>
      )}
    </group>
  )
}
