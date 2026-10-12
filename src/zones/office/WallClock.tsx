import { useRef } from 'react'
import type { Mesh, Object3D } from 'three'
import { MODEL_PARTS } from '../../three/assets'
import { Interactive } from '../../three/interactive'
import { SceneObject } from '../../three/objects'
import { handAngles, handRestAngle, handRotationZ } from './clockHands'
import { objectActions } from './interactions'
import { layout } from './layout'
import { useLightingApplier } from './lighting/live'

type Hand = keyof typeof MODEL_PARTS.clockHands

interface HandNode {
  hand: Hand
  node: Object3D
  rest: number
}

/**
 * Vertex positions of a hand node, read attribute by attribute: glTF-Transform writes interleaved vertex buffers, so the
 * raw array of the attribute is not a plain list of positions. The clock GLB is not quantised: these are metres in the
 * dial's frame, axis at the origin.
 */
function handPositions(node: Object3D): number[] {
  const values: number[] = []
  node.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) values.push(position.getX(i), position.getY(i), position.getZ(i))
  })
  return values
}

/**
 * The wall clock (Poly Haven wall_clock): a click moves the office to the next phase, like the HUD's Time of day button.
 * Its hands show the phase's time (14:00, 19:30, 23:00) and turn forward during a transition (lighting/live.ts minutes).
 */
export function WallClock() {
  const hands = useRef<HandNode[]>([])
  const { position, rotationY } = layout.objects.clock
  useLightingApplier((_preset, minutes) => {
    const angles = handAngles(minutes)
    for (const { hand, node, rest } of hands.current) node.rotation.z = handRotationZ(angles[hand], rest)
  })
  return (
    <Interactive id="clock" onActivate={objectActions.clock}>
      <SceneObject
        object="clock"
        name="clock"
        outline
        position={position}
        rotation-y={rotationY}
        onModel={(root) => {
          hands.current = (Object.keys(MODEL_PARTS.clockHands) as Hand[]).flatMap((hand) => {
            const node = root.getObjectByName(MODEL_PARTS.clockHands[hand])
            return node ? [{ hand, node, rest: handRestAngle(handPositions(node)) }] : []
          })
        }}
      />
    </Interactive>
  )
}
