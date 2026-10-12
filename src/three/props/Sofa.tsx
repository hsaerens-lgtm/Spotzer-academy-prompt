import { Vector3, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { between, roundedBox } from '../shapes'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/** Two-seat sofa, 2.0 x 0.8 x 0.9 m including its legs, front +z. */
export const SOFA = { width: 2.0, height: 0.8, depth: 0.9, legHeight: 0.12 } as const

let parts: { upholstery: BufferGeometry; pillows: BufferGeometry; legs: BufferGeometry } | null = null

function sofaParts() {
  const leg = SOFA.legHeight
  parts ??= {
    // Base, two seat cushions, back and arms in one geometry (one draw call), re-projected in metres after merging.
    upholstery: metreUVs(
      mergeParts([
        { geometry: roundedBox(2.0, 0.26, 0.9, 0.05), matrix: at(0, leg + 0.13, 0) },
        ...[-0.405, 0.405].map((x) => ({ geometry: roundedBox(0.79, 0.14, 0.66, 0.05), matrix: at(x, leg + 0.33, 0.08) })),
        { geometry: roundedBox(2.0, 0.42, 0.22, 0.07), matrix: at(0, leg + 0.47, -0.34) },
        ...[-0.9, 0.9].map((x) => ({ geometry: roundedBox(0.2, 0.5, 0.9, 0.07), matrix: at(x, leg + 0.25, 0) })),
      ]),
    ),
    // Two lime throw pillows leaning on the back.
    pillows: metreUVs(mergeParts([-0.45, 0.45].map((x) => ({ geometry: roundedBox(0.4, 0.3, 0.12, 0.05), matrix: at(x, 0.64, -0.17, [-0.25, 0, 0]) })))),
    // Four thin tapered legs.
    legs: metreUVs(
      mergeParts([-0.9, 0.9].flatMap((x) => [-0.36, 0.36].map((z) => between(new Vector3(x, 0, z), new Vector3(x, leg, z), 0.012, 0.018, 12)))),
    ),
  }
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
