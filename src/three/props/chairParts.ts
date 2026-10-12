import { Vector3, type BufferGeometry } from 'three'
import { at, mergeParts, type Part } from '../merge'
import { between, roundedBox } from '../shapes'
import { metreUVs } from '../uv'

/** Meeting chair, in metres: origin on the floor at its centre, front +z (footprint 0.56 x 0.9 x 0.56 in layout). */
export const CHAIR = { seatTop: 0.46, backTop: 0.9, half: 0.28 } as const

export interface ChairParts {
  /** Upholstered seat and back (chairFabric). */
  shell: BufferGeometry
  /** Four-spoke swivel base: glides, spokes, hub, column and seat plate (blackMetal). */
  base: BufferGeometry
}

function shellGeometry(): BufferGeometry {
  // Re-projected after merging, like the base: the fabric weave runs the same way on every chair part.
  return metreUVs(
    mergeParts([
      // Seat cushion, 7 cm thick, its top at 0.46 m.
      { geometry: roundedBox(0.5, 0.07, 0.48, 0.03), matrix: at(0, CHAIR.seatTop - 0.035, 0.01) },
      // Back, leaning 0.12 rad backwards, its top just under 0.9 m.
      { geometry: roundedBox(0.48, 0.42, 0.06, 0.025), matrix: at(0, 0.68, -0.22, [-0.12, 0, 0]) },
    ]),
  )
}

function baseGeometry(): BufferGeometry {
  const hub = new Vector3(0, 0.06, 0)
  const parts: Part[] = [
    between(new Vector3(0, 0.03, 0), new Vector3(0, 0.09, 0), 0.04, 0.035, 20),
    between(hub, new Vector3(0, 0.38, 0), 0.025, 0.022, 16),
    { geometry: roundedBox(0.3, 0.02, 0.3, 0.005), matrix: at(0, 0.38, 0) },
  ]
  // Four spokes on the diagonals, each ending on a small glide that stands on the floor.
  for (let k = 0; k < 4; k++) {
    const angle = Math.PI / 4 + (k * Math.PI) / 2
    const tip = new Vector3(Math.cos(angle) * 0.25, 0.025, Math.sin(angle) * 0.25)
    parts.push(between(hub, tip, 0.016, 0.011, 10))
    parts.push(between(new Vector3(tip.x, 0, tip.z), tip, 0.018, 0.018, 12))
  }
  // Cylinders come with 0..1 UVs: re-project the whole base in metres.
  return metreUVs(mergeParts(parts))
}

let parts: ChairParts | null = null

/** The two geometries shared by every chair, built once and never disposed (the office lives as long as the page). */
export function chairParts(): ChairParts {
  parts ??= { shell: shellGeometry(), base: baseGeometry() }
  return parts
}
