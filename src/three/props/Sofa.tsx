import { RoundedBox } from '@react-three/drei'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** Two-seat sofa, front facing +z. */
export function Sofa(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <RoundedBox args={[2.0, 0.3, 0.9]} radius={0.06} smoothness={3} position={[0, 0.2, 0]} material={m.sofaFabric} castShadow receiveShadow />
      {[-0.43, 0.43].map((x) => (
        <RoundedBox key={x} args={[0.84, 0.16, 0.66]} radius={0.06} smoothness={3} position={[x, 0.43, 0.08]} material={m.sofaFabric} castShadow />
      ))}
      <RoundedBox args={[2.0, 0.5, 0.22]} radius={0.08} smoothness={3} position={[0, 0.55, -0.34]} material={m.sofaFabric} castShadow />
      {[-0.95, 0.95].map((x) => (
        <RoundedBox key={x} args={[0.2, 0.56, 0.9]} radius={0.08} smoothness={3} position={[x, 0.33, 0]} material={m.sofaFabric} castShadow />
      ))}
      {[-0.85, 0.85].flatMap((x) =>
        [-0.35, 0.35].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.025, z]} material={m.metal}>
            <cylinderGeometry args={[0.02, 0.02, 0.05, 8]} />
          </mesh>
        )),
      )}
    </group>
  )
}
