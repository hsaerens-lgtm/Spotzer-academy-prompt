import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** Conference microphone; the gooseneck leans toward +z. */
export function Microphone(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.01} material={m.ink} castShadow>
        <boxGeometry args={[0.1, 0.02, 0.07]} />
      </mesh>
      <group position-y={0.02} rotation-x={0.45}>
        <mesh position-y={0.17} material={m.metal}>
          <cylinderGeometry args={[0.005, 0.005, 0.34, 8]} />
        </mesh>
        <mesh position-y={0.35} material={m.ink}>
          <cylinderGeometry args={[0.012, 0.01, 0.05, 12]} />
        </mesh>
        <mesh position-y={0.376} material={m.lime}>
          <cylinderGeometry args={[0.0125, 0.0125, 0.004, 12]} />
        </mesh>
      </group>
    </group>
  )
}
