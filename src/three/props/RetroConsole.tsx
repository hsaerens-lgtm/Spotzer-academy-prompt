import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import { HoverOutline } from '../interactive'
import { logoBoxes } from '../logo'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** A made-up 90s console: rounded grey case, the brand squares as buttons, a pad and a cable. */
export function RetroConsole(props: ObjectProps) {
  const m = materials()
  const cable = useMemo(
    () =>
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
    [],
  )
  useEffect(() => () => cable.dispose(), [cable])
  const buttons = logoBoxes(0.0012)
  const byColor = { lime: m.lime, mint: m.mint, ink: m.ink }
  return (
    <group {...props}>
      <RoundedBox args={[0.36, 0.07, 0.26]} radius={0.02} smoothness={3} position-y={0.035} material={m.plasticLight} castShadow>
        <HoverOutline />
      </RoundedBox>
      <mesh position={[0, 0.071, -0.04]} material={m.plasticDark}>
        <boxGeometry args={[0.2, 0.004, 0.08]} />
      </mesh>
      <group position={[0.11, 0.072, 0.07]} rotation-x={-Math.PI / 2}>
        {buttons.map((button, index) => (
          <mesh key={index} position={[button.position[0], button.position[1], 0.002]} material={byColor[button.color]}>
            <boxGeometry args={[button.size[0], button.size[1], 0.004]} />
          </mesh>
        ))}
      </group>
      <group position={[0.27, 0, 0.02]}>
        <RoundedBox args={[0.16, 0.03, 0.07]} radius={0.012} smoothness={3} position-y={0.015} material={m.plasticLight} castShadow />
        <mesh position={[-0.045, 0.031, 0]} material={m.plasticDark}>
          <boxGeometry args={[0.03, 0.004, 0.01]} />
        </mesh>
        <mesh position={[-0.045, 0.031, 0]} material={m.plasticDark}>
          <boxGeometry args={[0.01, 0.004, 0.03]} />
        </mesh>
        <mesh position={[0.04, 0.031, -0.008]} material={m.lime}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
        <mesh position={[0.058, 0.031, 0.008]} material={m.mint}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
      </group>
      <mesh geometry={cable} material={m.plasticDark} />
    </group>
  )
}
