import { Html } from '@react-three/drei'
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
  const { position, size } = layout.screen
  return (
    <group position={position} name="screen">
      <mesh position-z={-0.03} material={m.ink} castShadow>
        <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, 0.05]} />
      </mesh>
      <mesh material={m.screenOff}>
        <planeGeometry args={size} />
      </mesh>
      {/* Sits below the DOM overlay (z-index 10) and never catches the pointer, so the wheel still reaches the canvas. */}
      <Html
        transform
        distanceFactor={screenDistanceFactor(size[0])}
        position-z={0.003}
        zIndexRange={[5, 0]}
        pointerEvents="none"
        wrapperClass="wall-screen"
      >
        <ScreenContent screen={screen} />
      </Html>
    </group>
  )
}
