import { logoBoxes } from '../logo'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** The five-square mark as cubes on the wall, 0.72 m wide. Front faces +z. */
export function LogoCubes(props: ObjectProps) {
  const m = materials()
  const byColor = { lime: m.lime, mint: m.mint, ink: m.ink }
  return (
    <group {...props}>
      {logoBoxes(0.012).map((box, index) => (
        <mesh key={index} position={[box.position[0], box.position[1], 0.05]} material={byColor[box.color]} castShadow>
          <boxGeometry args={[box.size[0], box.size[1], 0.1]} />
        </mesh>
      ))}
    </group>
  )
}
