import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import { HoverOutline } from '../interactive'
import { logoBoxes } from '../logo'
import { useMaterials } from '../materials'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/**
 * A made-up 90s console: rounded grey case, the brand squares as buttons, a pad and a cable. Same shapes as before, retextured.
 * The 4 mm dark inlays (slot, ink button, d-pad) receive shadows but do not cast: flush with the case, a cast is invisible
 * and risks acne. The lime and mint buttons glow and take neither.
 */
export function RetroConsole(props: ObjectProps) {
  const m = useMaterials()
  const cable = useMemo(
    () =>
      metreUVs(
        new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(0, 0.03, -0.13),
            new Vector3(-0.12, 0.01, -0.2),
            new Vector3(-0.34, 0.01, -0.22),
            new Vector3(-0.44, 0.08, -0.18),
          ]),
          24,
          0.005,
          6,
        ),
      ),
    [],
  )
  useEffect(() => () => cable.dispose(), [cable])
  const buttons = logoBoxes(0.0012)
  const byColor = { lime: m.limeGlow, mint: m.mintGlow, ink: m.consoleDark }
  return (
    <group {...props}>
      <mesh geometry={roundedBox(0.36, 0.07, 0.26, 0.02)} position-y={0.035} material={m.consoleShell} castShadow receiveShadow>
        <HoverOutline />
      </mesh>
      <mesh geometry={roundedBox(0.2, 0.004, 0.08, 0.001)} position={[0, 0.071, -0.04]} material={m.consoleDark} receiveShadow />
      <group position={[0.11, 0.072, 0.07]} rotation-x={-Math.PI / 2}>
        {buttons.map((button, index) => (
          <mesh
            key={index}
            geometry={roundedBox(button.size[0], button.size[1], 0.004, 0.001)}
            position={[button.position[0], button.position[1], 0.002]}
            material={byColor[button.color]}
            receiveShadow={button.color === 'ink'}
          />
        ))}
      </group>
      <group position={[0.27, 0, 0.02]}>
        <mesh geometry={roundedBox(0.16, 0.03, 0.07, 0.012)} position-y={0.015} material={m.consoleShell} castShadow receiveShadow />
        <mesh geometry={roundedBox(0.03, 0.004, 0.01, 0.001)} position={[-0.045, 0.031, 0]} material={m.consoleDark} receiveShadow />
        <mesh geometry={roundedBox(0.01, 0.004, 0.03, 0.001)} position={[-0.045, 0.031, 0]} material={m.consoleDark} receiveShadow />
        <mesh position={[0.04, 0.031, -0.008]} material={m.limeGlow}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
        <mesh position={[0.058, 0.031, 0.008]} material={m.mintGlow}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
      </group>
      <mesh geometry={cable} material={m.consoleDark} castShadow receiveShadow />
    </group>
  )
}
