import { LOGO_H, LOGO_W, logoBoxes } from '../logo'
import { useMaterials } from '../materials'
import type { ObjectProps } from '../types'

/** Metres per SVG unit of the mark: 0.72 m wide, 0.936 m high. */
const SCALE = 0.012
/** The backlit plate shows this much around the mark. */
const MARGIN = 0.09

/**
 * The Athena sign on the back wall: the five-square mark as cubes in front of a plate that glows behind them, discreet
 * by day and bright at night (signBack and the logo materials follow the phase, see lighting/emissive.ts). Front +z.
 */
export function LogoCubes(props: ObjectProps) {
  const m = useMaterials()
  const byColor = { lime: m.logoLime, mint: m.logoMint, ink: m.logoInk }
  return (
    <group {...props}>
      <mesh position-z={0.005} material={m.signBack}>
        <boxGeometry args={[LOGO_W * SCALE + 2 * MARGIN, LOGO_H * SCALE + 2 * MARGIN, 0.01]} />
      </mesh>
      {logoBoxes(SCALE).map((box, index) => (
        <mesh key={index} position={[box.position[0], box.position[1], 0.05]} material={byColor[box.color]} castShadow receiveShadow>
          <boxGeometry args={[box.size[0], box.size[1], 0.1]} />
        </mesh>
      ))}
    </group>
  )
}
