import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { plantGeometry } from './plantGeometry'
import { plantMaterials } from './plantMaterials'
import { useSway } from './sway'
import type { PlantPlacement } from './types'

/**
 * A generated plant: its pot and its canopy, two meshes. The canopy sways about the pot's base when `animate`
 * (quality tier and reduced motion) and the placement asks for it (`sway` > 0); the sway's phase is the seed.
 */
export function Plant({ placement, animate, name }: { placement: PlantPlacement; animate: boolean; name?: string }) {
  const { kind, position, pot, r, h, scale, seed, sway, fall, reach } = placement
  const geometry = useMemo(() => plantGeometry(kind, { r, h, pot, scale, seed, fall, reach }), [kind, r, h, pot, scale, seed, fall, reach])
  const materials = plantMaterials()
  const canopy = useRef<Group>(null)
  useSway(canopy, sway, seed, animate && sway > 0)
  return (
    <group name={name} position={position}>
      {geometry.pot && pot !== 'none' && <mesh geometry={geometry.pot} material={materials.pots[pot]} castShadow receiveShadow />}
      <group ref={canopy}>
        <mesh geometry={geometry.canopy} material={materials.canopy} castShadow receiveShadow />
      </group>
    </group>
  )
}
