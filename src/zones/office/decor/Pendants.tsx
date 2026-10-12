import { useRef } from 'react'
import type { MeshStandardMaterial, Object3D } from 'three'
import { MODEL_PARTS } from '../../../three/assets'
import { markExempt } from '../../../three/audit'
import { meshesOf } from '../../../three/gltf'
import { SceneObject } from '../../../three/objects'
import { tints } from '../../../three/tints'
import { layout } from '../layout'
import { useLightingApplier } from '../lighting/live'
import { RIG } from '../lighting/rig'

/** Finds the bulb material of a pendant copy and makes it a warm emissive (one material, shared by the three copies). */
function bulbsOf(root: Object3D): MeshStandardMaterial[] {
  const bulbs: MeshStandardMaterial[] = []
  for (const mesh of meshesOf(root)) {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const bulb = material as MeshStandardMaterial
      if (bulb.name !== MODEL_PARTS.pendantBulb || !bulb.isMeshStandardMaterial) continue
      markExempt(bulb, 'emissive')
      bulb.emissive.set(tints.warmLight)
      bulbs.push(bulb)
    }
  }
  return bulbs
}

/** Three glass pendants above the table (Poly Haven modern_ceiling_lamp_01): off by day, lit at sunset and night. */
export function Pendants() {
  const bulbs = useRef(new Set<MeshStandardMaterial>())
  useLightingApplier((preset) => {
    for (const bulb of bulbs.current) bulb.emissiveIntensity = preset.bulb * RIG.emissivePeak
  })
  return (
    <>
      {layout.objects.pendants.map((pendant, index) => (
        <SceneObject
          key={index}
          object="pendant"
          name={`pendant-${index}`}
          position={pendant.position}
          rotation-y={pendant.rotationY ?? 0}
          onModel={(root) => {
            for (const bulb of bulbsOf(root)) bulbs.current.add(bulb)
          }}
        />
      ))}
    </>
  )
}
