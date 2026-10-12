import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { hangingGeometry } from './hanging'
import { plantMaterials } from './plantMaterials'
import { useSway } from './sway'
import type { HangingPlacement } from './types'

/** Pendulum amplitude of a hanging plant, in radians about its hook (Horn.os). */
export const HANGING_SWAY = 0.02

/** A hanging plant: cords, pot and canopy below the ceiling hook at `placement.position`, swinging about it when `animate`. */
export function HangingPlant({ placement, animate, name }: { placement: HangingPlacement; animate: boolean; name?: string }) {
  const { position, seed, glaze, vines, length, drop } = placement
  const geometry = useMemo(() => hangingGeometry({ seed, glaze, vines, length, drop }), [seed, glaze, vines, length, drop])
  const materials = plantMaterials()
  const pendulum = useRef<Group>(null)
  useSway(pendulum, HANGING_SWAY, seed, animate)
  return (
    <group name={name} position={position}>
      <group ref={pendulum}>
        <mesh geometry={geometry.cords} material={materials.cord} castShadow receiveShadow />
        <mesh geometry={geometry.pot} material={materials.hangingPots[glaze]} castShadow receiveShadow />
        <mesh geometry={geometry.canopy} material={materials.canopy} castShadow receiveShadow />
      </group>
    </group>
  )
}
