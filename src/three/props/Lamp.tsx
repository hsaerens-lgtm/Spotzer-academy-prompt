import { materials } from '../materials'
import type { ObjectProps } from '../types'

export function Lamp(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.01} material={m.metal}>
        <cylinderGeometry args={[0.07, 0.08, 0.02, 24]} />
      </mesh>
      <mesh position-y={0.17} material={m.metal}>
        <cylinderGeometry args={[0.012, 0.012, 0.32, 12]} />
      </mesh>
      <mesh position-y={0.31} material={m.warmGlow}>
        <sphereGeometry args={[0.13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <pointLight position-y={0.28} intensity={1.5} distance={3} decay={2} color="#FFC98A" />
    </group>
  )
}
