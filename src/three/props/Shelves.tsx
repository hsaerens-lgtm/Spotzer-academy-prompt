import type { BufferGeometry } from 'three'
import { SHELVES } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'

/** Bracket positions along each board, from its centre. */
const BRACKET_X = [-0.55, 0.55] as const

let parts: { boards: BufferGeometry; brackets: BufferGeometry } | null = null

function shelfParts() {
  const { width, depth, thickness, boards } = SHELVES
  const back = -depth / 2
  parts ??= {
    boards: mergeParts(boards.map((bottom) => ({ geometry: roundedBox(width, thickness, depth, 0.004), matrix: at(0, bottom + thickness / 2, 0) }))),
    // An L bracket under each end of each board: a plate screwed to the wall and an arm under the board.
    brackets: mergeParts(
      boards.flatMap((bottom) =>
        BRACKET_X.flatMap((x) => [
          { geometry: roundedBox(0.03, 0.16, 0.006, 0.002), matrix: at(x, bottom - 0.08, back + 0.003) },
          { geometry: roundedBox(0.03, 0.006, depth - 0.04, 0.002), matrix: at(x, bottom - 0.003, back + (depth - 0.04) / 2) },
        ]),
      ),
    ),
  }
  return parts
}

/** Two oak wall shelves on black brackets (SHELVES: boards at 1.3 and 1.75 m). Origin on the floor, against the wall, front +z. */
export function Shelves(props: ObjectProps) {
  const m = useMaterials()
  const { boards, brackets } = shelfParts()
  return (
    <group {...props}>
      <mesh geometry={boards} material={m.oak} castShadow receiveShadow />
      <mesh geometry={brackets} material={m.blackMetal} castShadow receiveShadow />
    </group>
  )
}
