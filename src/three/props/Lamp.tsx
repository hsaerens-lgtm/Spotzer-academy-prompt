import { CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/** Table lamp of the sideboard, in metres: radius 0.14 and 0.48 high. Its light is lamp-light, in lighting/Lights.tsx. */
export const LAMP = { footRadius: 0.09, footHeight: 0.03, stemRadius: 0.008, stemHeight: 0.3, shadeRadius: 0.14, top: 0.48 } as const

let parts: { foot: BufferGeometry; stem: BufferGeometry; shade: BufferGeometry } | null = null

function lampParts() {
  parts ??= {
    foot: metreUVs(new CylinderGeometry(LAMP.footRadius, LAMP.footRadius, LAMP.footHeight, 32)),
    stem: metreUVs(new CylinderGeometry(LAMP.stemRadius, LAMP.stemRadius, LAMP.stemHeight, 12)),
    // An opal globe cut a little below its equator, so the stem disappears into it.
    shade: new SphereGeometry(LAMP.shadeRadius, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
  }
  return parts
}

/** Walnut foot, brushed metal stem, opal dome that glows with the phase (lampShade, see lighting/emissive.ts). */
export function Lamp(props: ObjectProps) {
  const m = useMaterials()
  const { foot, stem, shade } = lampParts()
  return (
    <group {...props}>
      <mesh geometry={foot} position-y={LAMP.footHeight / 2} material={m.walnut} castShadow receiveShadow />
      <mesh geometry={stem} position-y={LAMP.footHeight + LAMP.stemHeight / 2} material={m.brushedMetal} castShadow receiveShadow />
      <mesh geometry={shade} position-y={LAMP.top - LAMP.shadeRadius} material={m.lampShade} />
    </group>
  )
}
