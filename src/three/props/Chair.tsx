import { RoundedBox } from '@react-three/drei'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

export function Chair(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <RoundedBox args={[0.56, 0.12, 0.52]} radius={0.05} smoothness={3} position={[0, 0.48, 0]} material={m.fabric} castShadow receiveShadow />
      <RoundedBox args={[0.56, 0.52, 0.1]} radius={0.05} smoothness={3} position={[0, 0.8, -0.24]} rotation-x={-0.12} material={m.fabric} castShadow />
      <mesh position-y={0.24} material={m.metal}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 12]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation-y={(i / 5) * Math.PI * 2}>
          <mesh position={[0, 0.04, 0.14]} material={m.metal}>
            <boxGeometry args={[0.035, 0.03, 0.28]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
