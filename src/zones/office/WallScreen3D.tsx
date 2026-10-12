import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useScreenRef } from '../../core/selectors'
import { useMaterials } from '../../three/materials'
import { roundedBox } from '../../three/shapes'
import { ScreenContent } from '../../visuals/ScreenContent'
import { layout } from './layout'

export const SCREEN_PX = { width: 1280, height: 720 }
/** The thin black bezel shows this much around the screen, all round. */
const BEZEL = 0.015

/** drei <Html transform> maps 1 CSS pixel to distanceFactor / 400 world units. */
export function screenDistanceFactor(widthMetres: number): number {
  return (widthMetres / SCREEN_PX.width) * 400
}

export function WallScreen3D() {
  const m = useMaterials()
  const screen = useScreenRef()
  // Mounting <Html> during the Canvas's first commit loses its content when drei's portal target settles.
  const connected = useThree((state) => state.events.connected)
  const { position, size } = layout.screen
  return (
    <group position={position} name="screen">
      <mesh geometry={roundedBox(size[0] + 2 * BEZEL, size[1] + 2 * BEZEL, 0.03, 0.004)} position-z={-0.016} material={m.blackMetal} castShadow receiveShadow />
      <mesh material={m.screenOff}>
        <planeGeometry args={size} />
      </mesh>
      {/* The DOM page and drei's occlusion plane are a screen: exempt from the material audit. */}
      <group userData={{ auditExempt: 'screen' }}>
        {/* Sits below the DOM overlay (z-index 10) and never catches the pointer. occlude="blending" lets foreground meshes hide it. */}
        {/* renderOrder -1 draws drei's occlusion plane before every other opaque object (three sorts by material before
            depth): its depth then spares the slats and the dark plane behind it from being lit, a third of the
            presentation view (Task 14b, about 6 ms a frame on the reference iGPU, the same pixels). */}
        {connected && (
          <Html
            transform
            occlude="blending"
            renderOrder={-1}
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
    </group>
  )
}
