import type { Mood } from '../../content/schema'
import { brand } from '../../core/brand'

export type EyeShape = 'round' | 'happy' | 'dots' | 'big' | 'wink' | 'closed'

export const FACE_W = 512
export const FACE_H = 256
const EYE_Y = 124
const EYE_DX = 92
const EYE_RX = 34
const EYE_RY = 44

export function eyeShapes(mood: Mood, blinking: boolean): [EyeShape, EyeShape] {
  if (blinking) return ['closed', 'closed']
  switch (mood) {
    case 'happy':
      return ['happy', 'happy']
    case 'thinking':
      return ['dots', 'dots']
    case 'surprised':
      return ['big', 'big']
    case 'encouraging':
      return ['round', 'wink']
    default:
      return ['round', 'round']
  }
}

/** A key that only changes when the drawn face would change. */
export function faceKey(shapes: [EyeShape, EyeShape], lookX: number, lookY: number, pulse: number, time: number): string {
  const dots = shapes.includes('dots') ? Math.floor(time * 4) % 3 : -1
  return `${shapes.join(',')}|${lookX.toFixed(2)}|${lookY.toFixed(2)}|${pulse.toFixed(1)}|${dots}`
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
}

function drawEye(ctx: CanvasRenderingContext2D, shape: EyeShape, cx: number, cy: number, pulse: number, time: number) {
  const scale = 1 + pulse * 0.08
  switch (shape) {
    case 'round':
      ellipse(ctx, cx, cy, EYE_RX * scale, EYE_RY * scale)
      ctx.fill()
      break
    case 'big':
      ellipse(ctx, cx, cy, EYE_RX * 1.3, EYE_RY * 1.25)
      ctx.fill()
      break
    case 'happy':
      ctx.beginPath()
      ctx.arc(cx, cy + 16, EYE_RX, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
      break
    case 'wink':
      ctx.beginPath()
      ctx.moveTo(cx - EYE_RX, cy)
      ctx.lineTo(cx + EYE_RX, cy)
      ctx.stroke()
      break
    case 'closed':
      ctx.beginPath()
      ctx.moveTo(cx - EYE_RX, cy + 4)
      ctx.lineTo(cx + EYE_RX, cy + 4)
      ctx.stroke()
      break
    case 'dots':
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = Math.floor(time * 4) % 3 === k ? 1 : 0.35
        ellipse(ctx, cx - 24 + k * 24, cy, 8, 8)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      break
  }
}

/** Draws both eyes in lime on the black visor texture. lookX/lookY are -1..1 (y up). */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  shapes: [EyeShape, EyeShape],
  { lookX, lookY, pulse, time }: { lookX: number; lookY: number; pulse: number; time: number },
) {
  ctx.fillStyle = '#030405'
  ctx.fillRect(0, 0, FACE_W, FACE_H)
  ctx.save()
  ctx.fillStyle = brand.lime
  ctx.strokeStyle = brand.lime
  ctx.lineCap = 'round'
  ctx.lineWidth = 16
  ctx.shadowColor = brand.lime
  ctx.shadowBlur = 24 + pulse * 16
  shapes.forEach((shape, index) => {
    const cx = FACE_W / 2 + (index === 0 ? -EYE_DX : EYE_DX) + lookX * 22
    const cy = EYE_Y - lookY * 12
    drawEye(ctx, shape, cx, cy, pulse, time)
  })
  ctx.restore()
}
