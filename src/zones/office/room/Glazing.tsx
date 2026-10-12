import { useEffect, useMemo } from 'react'
import { BoxGeometry, type Material } from 'three'
import { useMaterials } from '../../../three/materials'
import { metreUVs } from '../../../three/uv'
import { glassPanes, glazingFrameBoxes, type BoxSpec } from './plan'
import { withoutUnderside } from './underside'

/**
 * One box of the room plan, with UVs in metres so its PBR textures keep their real size. With underside={false} it
 * leaves out its bottom face, for a slab lying on the floor (see withoutUnderside).
 */
export function PlanBox({ spec, material, underside = true }: { spec: BoxSpec; material: Material; underside?: boolean }) {
  const geometry = useMemo(() => {
    const box = metreUVs(new BoxGeometry(...spec.size))
    return underside ? box : withoutUnderside(box)
  }, [spec, underside])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh
      name={spec.name}
      position={spec.center}
      geometry={geometry}
      material={material}
      castShadow={spec.castShadow}
      receiveShadow={spec.receiveShadow}
    />
  )
}

/**
 * The glazing: thin, faintly reflective glass (no transmission, no shadow) in a black aluminium frame. The posts and
 * transoms cast shadows, so the sun draws the frame on the floor. Nothing transparent stands in front of the wall
 * screen: the glass return ends at x = -3.4, left of it.
 */
export function Glazing() {
  const m = useMaterials()
  const frame = useMemo(glazingFrameBoxes, [])
  const panes = useMemo(glassPanes, [])
  return (
    <group name="glazing">
      {frame.map((spec) => (
        <PlanBox key={spec.name} spec={spec} material={m[spec.material]} />
      ))}
      {panes.map((pane) => (
        <mesh key={pane.name} name={pane.name} position={pane.center} rotation-y={pane.rotationY} material={m.glass}>
          <planeGeometry args={pane.size} />
        </mesh>
      ))}
    </group>
  )
}
