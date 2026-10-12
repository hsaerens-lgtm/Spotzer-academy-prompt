import type { BufferGeometry } from 'three'
import { TABLE } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { racetrackTop, roundedBox } from '../shapes'
import type { ObjectProps } from '../types'

/** Each T leg: a steel column on a foot bar across the table, at z = -1.3 and +1.3 from the centre. */
const LEG = { column: [0.08, 0.71, 0.08], foot: [0.9, 0.03, 0.12], z: 1.3 } as const

let parts: { top: BufferGeometry; legs: BufferGeometry } | null = null

function tableParts() {
  const [cw, ch, cd] = LEG.column
  const [fw, fh, fd] = LEG.foot
  parts ??= {
    // 2.5 x 5 m racetrack: the footprint of TABLE.radii, straight sides and semicircular ends (see tableHalfWidthAt).
    top: racetrackTop(TABLE.radii.x * 2, TABLE.radii.z * 2, TABLE.topThickness, TABLE.edgeRadius),
    legs: mergeParts(
      [-LEG.z, LEG.z].flatMap((z) => [
        { geometry: roundedBox(cw, ch, cd, 0.006), matrix: at(0, ch / 2, z) },
        { geometry: roundedBox(fw, fh, fd, 0.008), matrix: at(0, fh / 2, z) },
      ]),
    ),
  }
  return parts
}

/** Meeting table: oak racetrack top (its surface at TABLE.topY, 0.75 m) on two black steel T legs. Origin on the floor. */
export function Table(props: ObjectProps) {
  const m = useMaterials()
  const { top, legs } = tableParts()
  return (
    <group {...props}>
      <mesh geometry={top} position-y={TABLE.topY - TABLE.topThickness} material={m.oak} castShadow receiveShadow />
      <mesh geometry={legs} material={m.blackMetal} castShadow receiveShadow />
    </group>
  )
}
