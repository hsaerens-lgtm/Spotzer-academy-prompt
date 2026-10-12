import { CylinderGeometry, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/**
 * Floor lamp of the lounge corner, in metres: 0.4 m across (its shade) and 1.55 m high, the drum shade from 1.25 to
 * 1.55 m. Its light is floor-lamp-light, in lighting/Lights.tsx, at the centre of the shade.
 */
export const FLOOR_LAMP = {
  footRadius: 0.15,
  footHeight: 0.03,
  stemRadius: 0.011,
  stemHeight: 1.22,
  shadeRadius: 0.2,
  shadeHeight: 0.3,
  top: 1.55,
} as const

let parts: { foot: BufferGeometry; stem: BufferGeometry; shade: BufferGeometry } | null = null

// Radial segments in multiples of 4: a vertex on each axis, so the bounding box is the exact radius.
function floorLampParts() {
  const { footRadius, footHeight, stemRadius, stemHeight, shadeRadius, shadeHeight } = FLOOR_LAMP
  parts ??= {
    // A heavy disc, a little narrower on top.
    foot: metreUVs(new CylinderGeometry(footRadius - 0.01, footRadius, footHeight, 48)),
    stem: metreUVs(new CylinderGeometry(stemRadius, stemRadius, stemHeight, 12)),
    // A closed drum: its diffusers top and bottom glow with its sides.
    shade: new CylinderGeometry(shadeRadius, shadeRadius, shadeHeight, 48),
  }
  return parts
}

/** Walnut foot, brushed metal stem, opal drum shade that glows with the phase (lampShade, see lighting/emissive.ts). */
export function FloorLamp(props: ObjectProps) {
  const m = useMaterials()
  const { foot, stem, shade } = floorLampParts()
  const { footHeight, stemHeight, shadeHeight, top } = FLOOR_LAMP
  return (
    <group {...props}>
      <mesh geometry={foot} position-y={footHeight / 2} material={m.walnut} castShadow receiveShadow />
      <mesh geometry={stem} position-y={footHeight + stemHeight / 2} material={m.brushedMetal} castShadow receiveShadow />
      <mesh geometry={shade} position-y={top - shadeHeight / 2} material={m.lampShade} />
    </group>
  )
}
