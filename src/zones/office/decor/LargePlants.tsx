import { useRef } from 'react'
import type { Group } from 'three'
import { SceneObject } from '../../../three/objects'
import { useSway } from '../../../three/plants/sway'
import { layout } from '../layout'

/** Sway of the two large plants, in radians about their base (Horn.os furnish()). */
export const LARGE_PLANT_SWAY = 0.006
/** The money tree: the clay planter scaled up, the tree scaled to its height and standing on the planter's soil line. */
export const PACHIRA = { potScale: 1.6, height: 1.55, base: 0.325 } as const

/** The Poly Haven floor plants: a large potted plant by the glazing, a money tree in a clay planter in the back corner. */
export function LargePlants({ animate }: { animate: boolean }) {
  const { pottedPlant, pachira } = layout.objects.largePlants
  const potted = useRef<Group>(null)
  const tree = useRef<Group>(null)
  useSway(potted, LARGE_PLANT_SWAY, 1.3, animate)
  useSway(tree, LARGE_PLANT_SWAY, 4.7, animate)
  return (
    <>
      <group name="pottedPlant" position={pottedPlant.position} rotation-y={pottedPlant.rotationY ?? 0}>
        <group ref={potted}>
          <SceneObject object="pottedPlant" />
        </group>
      </group>
      <group name="pachira" position={pachira.position} rotation-y={pachira.rotationY ?? 0}>
        <SceneObject object="clayPot" scale={PACHIRA.potScale} />
        <group ref={tree} position-y={PACHIRA.base}>
          <SceneObject object="pachira" height={PACHIRA.height} />
        </group>
      </group>
    </>
  )
}
