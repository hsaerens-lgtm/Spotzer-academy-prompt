import type { BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'

/** Low media unit of the retro corner, 1.7 x 0.5 x 0.5 m: oak carcass on black steel legs, its top at 0.5 m. Front +z. */
export const TV_STAND = { width: 1.7, height: 0.5, depth: 0.5, legHeight: 0.1 } as const

let parts: { carcass: BufferGeometry; metal: BufferGeometry } | null = null

function tvStandParts() {
  const { width, height, depth, legHeight } = TV_STAND
  const body = height - legHeight
  parts ??= {
    carcass: roundedBox(width, body, depth, 0.012),
    metal: mergeParts([
      // Four square legs, set in from the corners.
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          geometry: roundedBox(0.035, legHeight, 0.035, 0.004),
          matrix: at(sx * (width / 2 - 0.07), legHeight / 2, sz * (depth / 2 - 0.06)),
        })),
      ),
      // The gap between the two doors and their pulls, just proud of the front.
      { geometry: roundedBox(0.006, body - 0.08, 0.004, 0.001), matrix: at(0, legHeight + body / 2, depth / 2 + 0.002) },
      ...[-1, 1].map((sx) => ({ geometry: roundedBox(0.12, 0.012, 0.012, 0.003), matrix: at(sx * 0.12, height - 0.08, depth / 2 + 0.006) })),
    ]),
  }
  return parts
}

export function TvStand(props: ObjectProps) {
  const m = useMaterials()
  const { carcass, metal } = tvStandParts()
  const { height, legHeight } = TV_STAND
  return (
    <group {...props}>
      <mesh geometry={carcass} position-y={legHeight + (height - legHeight) / 2} material={m.oak} castShadow receiveShadow />
      <mesh geometry={metal} material={m.blackMetal} castShadow receiveShadow />
    </group>
  )
}
