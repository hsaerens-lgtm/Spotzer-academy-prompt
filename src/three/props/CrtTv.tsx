import { RoundedBox } from '@react-three/drei'
import { HoverOutline } from '../interactive'
import { materials } from '../materials'
import type { Vec3 } from '../../zones/office/layout'
import type { ObjectProps } from '../types'

/** Screen area of the TV, in the TV's local frame (front = +z). */
export const CRT_SCREEN = { width: 0.46, height: 0.35, center: [0, 0.27, 0.253] as Vec3 }

export function CrtTv(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <RoundedBox args={[0.62, 0.5, 0.36]} radius={0.04} smoothness={3} position={[0, 0.25, 0.07]} material={m.plasticLight} castShadow receiveShadow>
        <HoverOutline />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.38, 0.22]} radius={0.05} smoothness={3} position={[0, 0.24, -0.2]} material={m.plasticLight} castShadow />
      <mesh position={[0, 0.27, 0.251]} material={m.plasticDark}>
        <boxGeometry args={[0.52, 0.4, 0.002]} />
      </mesh>
      <mesh position={[0.24, 0.05, 0.252]} material={m.lime}>
        <boxGeometry args={[0.03, 0.012, 0.004]} />
      </mesh>
    </group>
  )
}
