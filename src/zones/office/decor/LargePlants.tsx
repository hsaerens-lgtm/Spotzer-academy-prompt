import { useEffect, useMemo, useRef } from 'react'
import { CylinderGeometry, MeshStandardMaterial, type Group } from 'three'
import { ENV_MAP_INTENSITY } from '../../../three/materials'
import { noiseTexture } from '../../../three/noise'
import { SceneObject } from '../../../three/objects'
import { useSway } from '../../../three/plants/sway'
import { tints } from '../../../three/tints'
import { layout } from '../layout'
import { PACHIRA } from './pachira'

export { PACHIRA }

/** Sway of the two large plants, in radians about their base (Horn.os furnish()). */
export const LARGE_PLANT_SWAY = 0.006

/**
 * The soil of the clay planter, which comes empty: a dark disc just under the rim, the trunk's base at its top (the soil
 * line, PACHIRA.base). A colour map and a roughness map, both noise, so that it passes the material audit; shadows both ways.
 */
function PachiraSoil() {
  const { radius, thickness } = PACHIRA.soil
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        name: 'pachira-soil',
        color: tints.soil,
        map: noiseTexture({ size: 64, min: 0.4, max: 1, seed: 29, repeat: 6, srgb: true }),
        roughnessMap: noiseTexture({ seed: 31, repeat: 6 }),
        roughness: 1,
        envMapIntensity: ENV_MAP_INTENSITY.plant,
      }),
    [],
  )
  const geometry = useMemo(() => new CylinderGeometry(radius, radius, thickness, 32), [radius, thickness])
  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
    },
    [material, geometry],
  )
  return <mesh name="pachira-soil" position-y={PACHIRA.base - thickness / 2} geometry={geometry} material={material} castShadow receiveShadow />
}

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
          {/* The sway turns about the trunk's base; the model is moved so that this is the trunk, not the middle of its leaves. */}
          <group position={[PACHIRA.offset[0], 0, PACHIRA.offset[1]]}>
            <SceneObject object="pachira" height={PACHIRA.height} />
          </group>
        </group>
        <PachiraSoil />
      </group>
    </>
  )
}
