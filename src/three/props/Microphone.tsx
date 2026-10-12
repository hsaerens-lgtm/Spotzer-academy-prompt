import { CylinderGeometry, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

interface MicrophoneParts {
  base: BufferGeometry
  neck: BufferGeometry
  head: BufferGeometry
  ring: BufferGeometry
}

let parts: MicrophoneParts | null = null

/** Geometries shared by the six microphones, built once. */
function microphoneParts(): MicrophoneParts {
  parts ??= {
    base: roundedBox(0.1, 0.02, 0.07, 0.006),
    neck: metreUVs(new CylinderGeometry(0.005, 0.005, 0.34, 8)),
    head: metreUVs(new CylinderGeometry(0.012, 0.01, 0.05, 12)),
    ring: new CylinderGeometry(0.0125, 0.0125, 0.004, 12),
  }
  return parts
}

/** Conference microphone: brushed metal base and gooseneck, black head, lime ring. The gooseneck leans toward +z. */
export function Microphone(props: ObjectProps) {
  const m = useMaterials()
  const g = microphoneParts()
  return (
    <group {...props}>
      <mesh geometry={g.base} position-y={0.01} material={m.brushedMetal} castShadow receiveShadow />
      <group position-y={0.02} rotation-x={0.45}>
        <mesh geometry={g.neck} position-y={0.17} material={m.brushedMetal} castShadow receiveShadow />
        <mesh geometry={g.head} position-y={0.35} material={m.blackMetal} castShadow receiveShadow />
        <mesh geometry={g.ring} position-y={0.376} material={m.limeGlow} />
      </group>
    </group>
  )
}
