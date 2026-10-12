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

/** The parts of a pendant that glow, each with its level at the preset's full bulb level. */
const GLOWING_PARTS: Record<string, number> = {
  [MODEL_PARTS.pendantBulb]: RIG.emissivePeak,
  // The shell is opaque (the asset build drops its transmission, and nothing transparent may stand in front of the wall
  // screen), so it hides the bulb: it glows itself, as frosted glass lit from inside.
  [MODEL_PARTS.pendantShell]: RIG.pendantShellPeak,
}

/**
 * Finds the glowing materials of a pendant copy (bulb and shell, each shared by the three copies), makes them warm
 * emissives and returns each with its peak level.
 */
function glowingOf(root: Object3D): [MeshStandardMaterial, number][] {
  const glowing: [MeshStandardMaterial, number][] = []
  for (const mesh of meshesOf(root)) {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const part = material as MeshStandardMaterial
      const peak = GLOWING_PARTS[part.name]
      if (peak === undefined || !part.isMeshStandardMaterial) continue
      markExempt(part, 'emissive')
      part.emissive.set(tints.warmLight)
      glowing.push([part, peak])
    }
  }
  return glowing
}

/** Three frosted glass pendants above the table (Poly Haven modern_ceiling_lamp_01): off by day, lit at sunset and night. */
export function Pendants() {
  const glowing = useRef(new Map<MeshStandardMaterial, number>())
  useLightingApplier((preset) => {
    for (const [part, peak] of glowing.current) part.emissiveIntensity = preset.bulb * peak
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
            for (const [part, peak] of glowingOf(root)) glowing.current.set(part, peak)
          }}
        />
      ))}
    </>
  )
}
