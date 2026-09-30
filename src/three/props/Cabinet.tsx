import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** Low TV stand of the lounge corner: 1.7 m wide, 0.5 m high, front facing +z. */
export function Cabinet(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.25} material={m.darkWood} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.5, 0.5]} />
      </mesh>
    </group>
  )
}
