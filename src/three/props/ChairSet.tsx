import { Instance, Instances } from '@react-three/drei'
import type { Placement } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { chairParts } from './chairParts'

/**
 * The meeting chairs as two instanced meshes, the upholstered shell and the metal base, sharing the geometries of
 * chairParts(): two draw calls for all of them. One instance per placement, the shell instances named chair-<i>.
 * frustumCulled is off: an instanced mesh computes its bounding sphere once, possibly before the instances are placed,
 * and the chairs are on screen in every view anyway.
 */
export function ChairSet({ placements }: { placements: Placement[] }) {
  const m = useMaterials()
  const { shell, base } = chairParts()
  return (
    <group name="chairs">
      <Instances limit={placements.length} geometry={shell} material={m.chairFabric} castShadow receiveShadow frustumCulled={false}>
        {placements.map((chair, index) => (
          <Instance key={index} name={`chair-${index}`} position={chair.position} rotation-y={chair.rotationY ?? 0} />
        ))}
      </Instances>
      <Instances limit={placements.length} geometry={base} material={m.blackMetal} castShadow receiveShadow frustumCulled={false}>
        {placements.map((chair, index) => (
          <Instance key={index} position={chair.position} rotation-y={chair.rotationY ?? 0} />
        ))}
      </Instances>
    </group>
  )
}
