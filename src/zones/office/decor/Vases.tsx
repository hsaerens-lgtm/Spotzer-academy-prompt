import { useSoftwareRenderer } from '../../../app/quality'
import { SceneObject } from '../../../three/objects'
import { Plant } from '../../../three/plants/Plant'
import type { VasePlacement } from '../../../three/plants/types'
import { SIZES } from '../footprints'
import { layout, type Vec3 } from '../layout'

/** Height of the two Poly Haven vases as loaded (no scaling), in metres. */
export const VASE_HEIGHTS: Record<VasePlacement['model'], number> = { vaseTall: 0.4, vaseRound: 0.34 }
/** A vase plant sits this far inside the vase's mouth, so no gap shows between the rim and the stems. */
export const RIM_INSET = 0.03

/** Where the potless plant of a vase stands: on the vase's axis, just inside its rim. */
export function vasePlantPosition(vase: VasePlacement): Vec3 {
  const [x, y, z] = vase.position
  return [x, y + VASE_HEIGHTS[vase.model] - RIM_INSET, z]
}

/** The vase that stands on the sideboard's top: SideboardSet hides the cabinets without a GPU, and it goes with them. */
const onSideboard = (vase: VasePlacement) => vase.position[1] === SIZES.sideboard[1]

/** The two ceramic vases, each with a small generated plant growing out of it. */
export function Vases({ animate }: { animate: boolean }) {
  const software = useSoftwareRenderer()
  return (
    <>
      {layout.objects.vases.map((vase, index) => (
        <group key={index} visible={!(software && onSideboard(vase))}>
          <SceneObject object={vase.model} name={`vase-${index}`} position={vase.position} rotation-y={vase.rotationY ?? 0} />
          <Plant name={`vasePlant-${index}`} placement={{ ...vase.plant, position: vasePlantPosition(vase), pot: 'none' }} animate={animate} />
        </group>
      ))}
    </>
  )
}
