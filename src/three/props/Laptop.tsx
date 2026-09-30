import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { brand } from '../../core/brand'
import { HoverOutline } from '../interactive'
import { materials } from '../materials'
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

export function Laptop(props: ObjectProps) {
  const m = materials()
  const texture = useMemo(screenTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group {...props}>
      <RoundedBox args={[0.34, 0.018, 0.24]} radius={0.008} smoothness={2} position-y={0.009} material={m.metal} castShadow>
        <HoverOutline />
      </RoundedBox>
      {/* hinge at the back edge; the lid leans back 15° */}
      <group position={[0, 0.018, -0.12]} rotation-x={-0.26}>
        <RoundedBox args={[0.34, 0.22, 0.012]} radius={0.006} smoothness={2} position={[0, 0.11, -0.006]} material={m.metal} castShadow>
          <HoverOutline />
        </RoundedBox>
        <mesh position={[0, 0.112, 0.0008]}>
          <planeGeometry args={[0.31, 0.19]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
