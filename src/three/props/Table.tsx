import { materials } from '../materials'
import type { ObjectProps } from '../types'

export function Table(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.72} scale={[1.25, 1, 2.5]} material={m.darkWood} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 0.06, 64]} />
      </mesh>
      {[-1.3, 1.3].map((z) => (
        <group key={z} position-z={z}>
          <mesh position-y={0.36} material={m.darkWood} castShadow>
            <cylinderGeometry args={[0.16, 0.22, 0.66, 24]} />
          </mesh>
          <mesh position-y={0.02} scale={[1, 1, 1.5]} material={m.darkWood} receiveShadow>
            <cylinderGeometry args={[0.42, 0.46, 0.04, 32]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
