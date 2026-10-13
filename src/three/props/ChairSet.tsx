import { Instance, Instances } from '@react-three/drei'
import type { BufferGeometry, Material } from 'three'
import type { Placement } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { chairParts } from './chairParts'

/**
 * The meeting chairs as three instanced meshes, upholstery, black frame and chrome column, sharing the geometries of
 * chairParts(): three draw calls for all of them. One instance per placement, the upholstery instances named chair-<i>.
 * frustumCulled is off: an instanced mesh computes its bounding sphere once, possibly before the instances are placed,
 * and the chairs are on screen in every view anyway.
 */
export function ChairSet({ placements }: { placements: Placement[] }) {
  const m = useMaterials()
  const { fabric, frame, chrome } = chairParts()
  const part = (geometry: BufferGeometry, material: Material, named: boolean) => (
    <Instances limit={placements.length} geometry={geometry} material={material} castShadow receiveShadow frustumCulled={false}>
      {placements.map((chair, index) => (
        <Instance key={index} name={named ? `chair-${index}` : undefined} position={chair.position} rotation-y={chair.rotationY ?? 0} />
      ))}
    </Instances>
  )
  return (
    <group name="chairs">
      {part(fabric, m.chairFabric, true)}
      {part(frame, m.blackMetal, false)}
      {part(chrome, m.brushedMetal, false)}
    </group>
  )
}
