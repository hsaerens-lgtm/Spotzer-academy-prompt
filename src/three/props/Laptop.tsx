import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { brand } from '../../core/brand'
import { HoverOutline } from '../interactive'
import { useMaterials } from '../materials'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'

/** Abstract "app window" for the laptop screen: shapes only, no text to translate. */
function screenTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = brand.surface1
  ctx.fillRect(0, 0, 512, 320)
  ctx.fillStyle = brand.surface3
  ctx.fillRect(0, 0, 512, 36)
  ctx.fillStyle = brand.lime
  ctx.fillRect(24, 64, 180, 18)
  ctx.fillStyle = 'rgba(244,246,245,0.35)'
  for (let row = 0; row < 5; row++) ctx.fillRect(24, 110 + row * 30, 300 + ((row * 53) % 140), 12)
  ctx.fillStyle = brand.mint
  ctx.fillRect(24, 272, 110, 26)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Aluminium laptop at the end of the table: base, lid leaning back 15 degrees, and its glowing screen (audit: screen). */
export function Laptop(props: ObjectProps) {
  const m = useMaterials()
  const texture = useMemo(screenTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group {...props}>
      <mesh geometry={roundedBox(0.34, 0.018, 0.24, 0.008)} position-y={0.009} material={m.brushedMetal} castShadow receiveShadow>
        <HoverOutline />
      </mesh>
      {/* hinge at the back edge; the lid leans back 15 degrees */}
      <group position={[0, 0.018, -0.12]} rotation-x={-0.26}>
        <mesh geometry={roundedBox(0.34, 0.22, 0.012, 0.006)} position={[0, 0.11, -0.006]} material={m.brushedMetal} castShadow receiveShadow>
          <HoverOutline />
        </mesh>
        <mesh position={[0, 0.112, 0.0008]} userData={{ auditExempt: 'screen' }}>
          <planeGeometry args={[0.31, 0.19]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
