import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasTexture, NearestFilter, SRGBColorSpace, type Mesh } from 'three'
import { brand } from '../../core/brand'
import { useApp } from '../../core/store'
import { logoBoxes } from '../../three/logo'
import { CRT_SCREEN } from '../../three/props/CrtTv'
import { layout } from './layout'

export const BLINK_SECONDS = 0.6
const W = 160
const H = 120
const NOISE_W = 96
const NOISE_H = 72

export const blinkOn = (time: number) => Math.floor(time / BLINK_SECONDS) % 2 === 0

export function fillNoise(data: Uint8ClampedArray, rand: () => number) {
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.round(rand() * 255)
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
}

function pixelTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  return texture
}

function drawTitle(title: string, pressStart: string) {
  const base = document.createElement('canvas')
  base.width = W
  base.height = H
  const ctx = base.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = brand.blueGrey
  ctx.fillRect(0, 0, W, H)
  const colors = { lime: brand.lime, mint: brand.mint, ink: brand.onDark }
  for (const box of logoBoxes(0.5)) {
    ctx.fillStyle = colors[box.color]
    ctx.fillRect(
      Math.round(W / 2 + box.position[0] - box.size[0] / 2),
      Math.round(34 - box.position[1] - box.size[1] / 2),
      Math.round(box.size[0]),
      Math.round(box.size[1]),
    )
  }
  ctx.fillStyle = brand.lime
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(title.toUpperCase(), W / 2, 84)

  const press = document.createElement('canvas')
  press.width = W
  press.height = H
  const pctx = press.getContext('2d')!
  pctx.imageSmoothingEnabled = false
  pctx.fillStyle = brand.onDark
  pctx.font = 'bold 10px monospace'
  pctx.textAlign = 'center'
  pctx.fillText(pressStart.toUpperCase(), W / 2, 106)

  return { base: pixelTexture(base), press: pixelTexture(press) }
}

function createNoise() {
  const canvas = document.createElement('canvas')
  canvas.width = NOISE_W
  canvas.height = NOISE_H
  const ctx = canvas.getContext('2d')!
  return { ctx, image: ctx.createImageData(NOISE_W, NOISE_H), texture: pixelTexture(canvas) }
}

/** The TV picture: a pixel-art title with a blinking PRESS START, static noise while flying into the TV. */
export function CrtScreen() {
  const { t } = useTranslation()
  const noiseOn = useApp((s) => s.transition?.via === 'tv')
  const title = useMemo(() => drawTitle(t('crt.title'), t('crt.pressStart')), [t])
  const noise = useMemo(createNoise, [])
  const pressRef = useRef<Mesh>(null)
  const { position, rotationY } = layout.objects.tv
  const [cx, cy, cz] = CRT_SCREEN.center

  useEffect(
    () => () => {
      title.base.dispose()
      title.press.dispose()
    },
    [title],
  )
  useEffect(() => () => noise.texture.dispose(), [noise])

  useFrame((state) => {
    if (pressRef.current) pressRef.current.visible = blinkOn(state.clock.elapsedTime)
    if (noiseOn) {
      fillNoise(noise.image.data, Math.random)
      noise.ctx.putImageData(noise.image, 0, 0)
      noise.texture.needsUpdate = true
    }
  })

  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[cx, cy, cz + 0.001]}>
        <planeGeometry args={[CRT_SCREEN.width, CRT_SCREEN.height]} />
        <meshBasicMaterial map={noiseOn ? noise.texture : title.base} toneMapped={false} />
      </mesh>
      {!noiseOn && (
        <mesh ref={pressRef} position={[cx, cy, cz + 0.002]}>
          <planeGeometry args={[CRT_SCREEN.width, CRT_SCREEN.height]} />
          <meshBasicMaterial map={title.press} transparent toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
