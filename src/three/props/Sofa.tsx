import { Vector3, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import { at, mergeParts, type Part } from '../merge'
import { between, roundedBox } from '../shapes'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/**
 * Low modern three-seater, in metres, front +z: 2.2 m wide, 0.92 m deep, its back 0.78 m high, the seat at 0.43 m.
 * A plinth on four thin legs, slim arms, a back rail, and three seat and three back cushions with soft edges.
 */
export const SOFA = {
  width: 2.2,
  height: 0.78,
  depth: 0.92,
  seatTop: 0.43,
  legHeight: 0.1,
  seats: 3,
  /** Distance between the centres of two neighbouring cushions. */
  cushionPitch: 0.64,
} as const

const ARM = 0.14
const PLINTH_TOP = 0.3
const BACK_RAIL = 0.16

export interface SofaParts {
  /** Plinth, arms, back rail and the six cushions (sofaFabric). */
  upholstery: BufferGeometry
  /** Two throw pillows leaning on the outer back cushions (cushion). */
  pillows: BufferGeometry
  /** Four thin tapered legs (blackMetal). */
  legs: BufferGeometry
}

function upholsteryGeometry(): BufferGeometry {
  const { width, height, depth, legHeight, seatTop, cushionPitch } = SOFA
  const cushionWidth = cushionPitch - 0.01
  const seatDepth = depth - BACK_RAIL - 0.02
  const parts: Part[] = [
    // Plinth, from the legs to under the cushions.
    { geometry: roundedBox(width, PLINTH_TOP - legHeight, depth, 0.03), matrix: at(0, (legHeight + PLINTH_TOP) / 2, 0) },
    // Back rail, the full height of the sofa.
    { geometry: roundedBox(width, height - PLINTH_TOP, BACK_RAIL, 0.04), matrix: at(0, (PLINTH_TOP + height) / 2, -(depth - BACK_RAIL) / 2) },
  ]
  // Slim arms, up to the middle of the back cushions.
  for (const side of [-1, 1]) {
    parts.push({ geometry: roundedBox(ARM, 0.6 - legHeight, depth, 0.045), matrix: at(side * (width - ARM) / 2, (legHeight + 0.6) / 2, 0) })
  }
  for (let i = 0; i < SOFA.seats; i++) {
    const x = (i - 1) * cushionPitch
    // Seat cushion, from the plinth to the seat height, in front of the back rail.
    parts.push({
      geometry: roundedBox(cushionWidth, seatTop - PLINTH_TOP, seatDepth, 0.05),
      matrix: at(x, (PLINTH_TOP + seatTop) / 2, (depth - seatDepth) / 2 - 0.01),
    })
    // Back cushion, leaning slightly against the rail.
    parts.push({ geometry: roundedBox(cushionWidth, 0.36, 0.15, 0.06), matrix: at(x, 0.59, -0.235, [-0.1, 0, 0]) })
  }
  // Rounded boxes come with their own UVs: re-project the merged upholstery in metres, the weave running the same way.
  return metreUVs(mergeParts(parts))
}

function pillowsGeometry(): BufferGeometry {
  return metreUVs(
    mergeParts(
      [-1, 1].map((side) => ({
        geometry: roundedBox(0.42, 0.32, 0.12, 0.05),
        matrix: at(side * SOFA.cushionPitch, 0.6, -0.1, [-0.3, 0, side * 0.08]),
      })),
    ),
  )
}

function legsGeometry(): BufferGeometry {
  const { width, depth, legHeight } = SOFA
  const inset = 0.08
  return metreUVs(
    mergeParts(
      [-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => {
          const x = sx * (width / 2 - inset)
          const z = sz * (depth / 2 - inset)
          return between(new Vector3(x, 0, z), new Vector3(x, legHeight, z), 0.012, 0.018, 12)
        }),
      ),
    ),
  )
}

let parts: SofaParts | null = null

/** The sofa's geometries, built once and never disposed (the office keeps them for the page). */
export function sofaParts(): SofaParts {
  parts ??= { upholstery: upholsteryGeometry(), pillows: pillowsGeometry(), legs: legsGeometry() }
  return parts
}

export function Sofa(props: ObjectProps) {
  const m = useMaterials()
  const { upholstery, pillows, legs } = sofaParts()
  return (
    <group {...props}>
      <mesh geometry={upholstery} material={m.sofaFabric} castShadow receiveShadow />
      <mesh geometry={pillows} material={m.cushion} castShadow receiveShadow />
      <mesh geometry={legs} material={m.blackMetal} castShadow receiveShadow />
    </group>
  )
}
