import { materials } from '../materials'
import type { ObjectProps } from '../types'

const WIDTH = 4.6
const HEIGHT = 0.7
const DEPTH = 0.5

export function Sideboard(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={(HEIGHT - 0.06) / 2 + 0.04} material={m.darkWood} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT - 0.06, DEPTH]} />
      </mesh>
      <mesh position-y={HEIGHT + 0.01} material={m.darkWood} castShadow>
        <boxGeometry args={[WIDTH + 0.06, 0.03, DEPTH + 0.06]} />
      </mesh>
      {/* warm light strip under the overhanging top, as in the reference photo */}
      <mesh position={[0, HEIGHT - 0.012, DEPTH / 2 + 0.01]} material={m.warmGlow}>
        <boxGeometry args={[WIDTH - 0.1, 0.012, 0.02]} />
      </mesh>
    </group>
  )
}
