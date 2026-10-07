// Ported from Horn.os (owner's project): js/scene/models.js (speckle), drawn into a DataTexture instead of a canvas
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'

/*
 * Small procedural textures computed in memory (no canvas, so they also work in the unit tests): a grey value noise
 * that breaks up flat colours and roughness, and Horn.os' glaze speckle for pots. Both are cached and never disposed.
 */

export interface NoiseOptions {
  size?: number
  min?: number
  max?: number
  seed?: number
  repeat?: number
  srgb?: boolean
}
export interface SpeckleOptions {
  base: string
  dots: readonly string[]
  seed: number
  size?: number
  count?: number
  repeat?: [number, number]
}

/** Horn.os' LCG: the same seed gives the same texture on every run. Returns numbers in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function dataTexture(data: Uint8Array, size: number, repeat: [number, number], srgb: boolean): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
  texture.needsUpdate = true
  return texture
}

/** Three octaves of tileable value noise (lattices of 4, 8 and 16 cells across the texture), in [0, 1). */
const OCTAVES = [
  { cells: 4, weight: 0.5 },
  { cells: 8, weight: 0.3 },
  { cells: 16, weight: 0.2 },
] as const
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function valueNoise(size: number, seed: number): Float32Array {
  const random = lcg(seed)
  const out = new Float32Array(size * size)
  for (const { cells, weight } of OCTAVES) {
    const lattice = new Float32Array(cells * cells)
    for (let i = 0; i < lattice.length; i++) lattice[i] = random()
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells
      const y0 = Math.floor(fy)
      const y1 = (y0 + 1) % cells
      const ty = smooth(fy - y0)
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells
        const x0 = Math.floor(fx)
        const x1 = (x0 + 1) % cells
        const tx = smooth(fx - x0)
        const top = lerp(lattice[y0 * cells + x0], lattice[y0 * cells + x1], tx)
        const bottom = lerp(lattice[y1 * cells + x0], lattice[y1 * cells + x1], tx)
        out[y * size + x] += weight * lerp(top, bottom, ty)
      }
    }
  }
  return out
}

const noiseCache = new Map<string, DataTexture>()

/** Grey value noise between `min` and `max` (0..1), RGBA8, tileable, with mipmaps. Defaults: 64 px, 0.85..1, seed 1, repeat 1, linear. */
export function noiseTexture(options: NoiseOptions = {}): DataTexture {
  const { size = 64, min = 0.85, max = 1, seed = 1, repeat = 1, srgb = false } = options
  const key = JSON.stringify([size, min, max, seed, repeat, srgb])
  const cached = noiseCache.get(key)
  if (cached) return cached
  const noise = valueNoise(size, seed)
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < noise.length; i++) {
    const value = Math.round((min + (max - min) * noise[i]) * 255)
    data[i * 4] = value
    data[i * 4 + 1] = value
    data[i * 4 + 2] = value
    data[i * 4 + 3] = 255
  }
  const texture = dataTexture(data, size, [repeat, repeat], srgb)
  noiseCache.set(key, texture)
  return texture
}

/** sRGB bytes of a CSS colour. */
function bytes(colour: string): [number, number, number] {
  const hex = new Color(colour).getHex()
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

const speckleCache = new Map<string, DataTexture>()

/**
 * A glaze: the base colour with `count` small translucent dots of the `dots` colours (Horn.os speckle: same LCG,
 * same draw order, dots of 1 to 2 px that wrap around the edges). sRGB. Defaults: 256 px, 1200 dots, repeat 3 x 1.
 */
export function speckleTexture(options: SpeckleOptions): DataTexture {
  const { base, dots, seed, size = 256, count = 1200, repeat = [3, 1] } = options
  const key = JSON.stringify([base, dots, seed, size, count, repeat])
  const cached = speckleCache.get(key)
  if (cached) return cached
  const data = new Uint8Array(size * size * 4)
  const [r, g, b] = bytes(base)
  for (let i = 0; i < size * size; i++) data.set([r, g, b, 255], i * 4)
  const palette = dots.map(bytes)
  const random = lcg(seed)
  for (let n = 0; n < count; n++) {
    const colour = palette[Math.floor(random() * palette.length)]
    const alpha = 0.15 + random() * 0.35
    const width = Math.max(1, Math.round(0.6 + random() * 1.8))
    const x = Math.floor(random() * size)
    const y = Math.floor(random() * size)
    for (let dy = 0; dy < width; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const at = (((y + dy) % size) * size + ((x + dx) % size)) * 4
        for (let c = 0; c < 3; c++) data[at + c] = Math.round(data[at + c] + (colour[c] - data[at + c]) * alpha)
      }
    }
  }
  const texture = dataTexture(data, size, repeat, true)
  speckleCache.set(key, texture)
  return texture
}
