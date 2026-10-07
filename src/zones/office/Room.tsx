import { useEffect, useMemo } from 'react'
import { BoxGeometry } from 'three'
import { useMaterials } from '../../three/materials'
import { at, mergeParts } from '../../three/merge'
import { metreUVs } from '../../three/uv'
import { Glazing, PlanBox } from './room/Glazing'
import { banquetteBoxes, ceilingLineBoxes, rugBox, shellBoxes, slatBoxes } from './room/plan'

/**
 * The 78 oak slats as one mesh (one draw call, one shadow caster); each slat starts its grain somewhere else, and the
 * grain runs up the slat (the oak set's grain is horizontal, so the UVs are turned a quarter).
 */
function SlatWall() {
  const m = useMaterials()
  const geometry = useMemo(() => {
    const parts = slatBoxes().map((slat, i) => ({
      geometry: metreUVs(new BoxGeometry(...slat.size), { offset: [(i * 0.37) % 1, (i * 0.61) % 1], swap: true }),
      matrix: at(...slat.center),
    }))
    const merged = mergeParts(parts)
    for (const part of parts) part.geometry.dispose()
    return merged
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="slat-wall" geometry={geometry} material={m.slats} castShadow receiveShadow />
}

/**
 * The meeting room: 20 cm slabs and walls that cast and receive shadows, the glazing on the left facade and behind
 * Ada, the slat wall behind the screen, the banquette along the glass, the ceiling lines and the rug.
 */
export function Room() {
  const m = useMaterials()
  const boxes = useMemo(() => [...shellBoxes(), ...banquetteBoxes(), ...ceilingLineBoxes(), rugBox()], [])
  return (
    <group name="room">
      {boxes.map((spec) => (
        <PlanBox key={spec.name} spec={spec} material={m[spec.material]} />
      ))}
      <SlatWall />
      <Glazing />
    </group>
  )
}
