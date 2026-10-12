// Ported from Horn.os (owner's project): js/scene/office.js (buildArt: the composition and the paper grain), LCG kept
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { brand } from '../../../core/brand'
import { MAX_ANISOTROPY } from '../../../three/textures'
import { tints } from '../../../three/tints'

/** Brand colours a poster may use (keys of core/brand.ts). */
export const POSTER_COLOURS = ['lime', 'mint', 'blueGrey', 'ink', 'surface3'] as const
export type PosterColour = (typeof POSTER_COLOURS)[number]
/** One shape, in 0..1 poster coordinates from the top left. A circle fills the largest disc of its box. */
export interface PosterShape {
  kind: 'rect' | 'circle'
  x: number
  y: number
  w: number
  h: number
  colour: PosterColour
}
export interface PosterDesign {
  paper: string
  shapes: PosterShape[]
}
/** Pixel size of a poster: the 0.594 x 0.841 m artwork of hanging_picture_frame_01 (ISO A ratio). */
export const POSTER_SIZE = { width: 512, height: 724 } as const

/** Horn.os' LCG: the same seed gives the same poster on every run. Returns numbers in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * An abstract Swiss-style composition in the Athena colours, after the print in Horn.os' office: a disc, a slab, a
 * column, a stair and a base line, placed by the seed. Pure (no DOM). Never any letter: posters carry no text.
 */
export function posterDesign(seed: number): PosterDesign {
  const random = lcg(seed)
  const range = (min: number, max: number) => min + (max - min) * random()
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]
  const aspect = POSTER_SIZE.width / POSTER_SIZE.height
  const shapes: PosterShape[] = []
  // A disc in the upper half, in an accent colour (its box is square in pixels).
  const disc = range(0.3, 0.45)
  shapes.push({ kind: 'circle', x: range(0.08, 0.92 - disc), y: range(0.08, 0.28), w: disc, h: disc * aspect, colour: pick(['lime', 'mint'] as const) })
  // A slab across the middle, and a column standing under it.
  const slab = { x: range(0.08, 0.2), y: range(0.48, 0.56), w: range(0.5, 0.72), h: range(0.03, 0.05) }
  shapes.push({ kind: 'rect', ...slab, colour: pick(['blueGrey', 'ink'] as const) })
  const columnWidth = range(0.05, 0.08)
  shapes.push({ kind: 'rect', x: range(slab.x, slab.x + 0.25), y: slab.y + slab.h, w: columnWidth, h: range(0.2, 0.28), colour: pick(POSTER_COLOURS) })
  // A stair of one to five steps rising to the right, standing on the base line.
  const steps = 1 + Math.floor(random() * 5)
  const stairColour = pick(['ink', 'blueGrey', 'surface3'] as const)
  for (let k = 0; k < steps; k++) {
    const h = 0.05 * (k + 1)
    shapes.push({ kind: 'rect', x: 0.52 + k * 0.07, y: 0.88 - h, w: 0.07, h, colour: stairColour })
  }
  // The base line.
  shapes.push({ kind: 'rect', x: 0.08, y: 0.9, w: 0.84, h: 0.006, colour: 'ink' })
  return { paper: tints.posterPaper, shapes }
}

/** The poster painted on a canvas: paper with a light grain, then the shapes. sRGB, glTF UV convention (no flip). */
export function posterTexture(design: PosterDesign, width: number = POSTER_SIZE.width, height: number = POSTER_SIZE.height): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = design.paper
  ctx.fillRect(0, 0, width, height)
  const grain = lcg(12)
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = grain() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,255,0.06)'
    ctx.fillRect(grain() * width, grain() * height, 1 + grain() * 2, 1 + grain() * 2)
  }
  for (const shape of design.shapes) {
    ctx.fillStyle = brand[shape.colour]
    const [x, y, w, h] = [shape.x * width, shape.y * height, shape.w * width, shape.h * height]
    if (shape.kind === 'rect') {
      ctx.fillRect(x, y, w, h)
    } else {
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = MAX_ANISOTROPY
  // The artwork mesh comes from a glTF file, whose UVs expect unflipped images.
  texture.flipY = false
  return texture
}

/** A UV rectangle: [u0, v0, u1, v1]. */
export type UvRect = readonly [number, number, number, number]

/** The rectangle of texture space a mesh samples (normalised, quantised UVs read as 0..1). */
export function uvRect(uv: { count: number; getX(index: number): number; getY(index: number): number }): UvRect {
  let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i < uv.count; i++) {
    u0 = Math.min(u0, uv.getX(i))
    u1 = Math.max(u1, uv.getX(i))
    v0 = Math.min(v0, uv.getY(i))
    v1 = Math.max(v1, uv.getY(i))
  }
  return [u0, v0, u1, v1]
}

/**
 * Stretches a texture over a UV rectangle, its corners on the rectangle's corners. hanging_picture_frame_01's artwork
 * samples only the middle of its square image (u 0.165 to 0.835): fitted, the poster shows whole, its disc round.
 */
export function fitToUvRect(texture: Texture, [u0, v0, u1, v1]: UvRect): void {
  texture.repeat.set(1 / (u1 - u0), 1 / (v1 - v0))
  texture.offset.set(-u0 / (u1 - u0), -v0 / (v1 - v0))
}
