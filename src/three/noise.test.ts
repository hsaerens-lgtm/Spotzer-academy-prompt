import { Color, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'
import { noiseTexture, normalNoiseTexture, speckleTexture } from './noise'
import { tints } from './tints'

const pixels = (texture: { image: { data: unknown } }) => texture.image.data as Uint8Array

test('noise is the same for the same seed', () => {
  const a = noiseTexture({ size: 32, seed: 4 })
  expect(noiseTexture({ size: 32, seed: 4 })).toBe(a)
  const b = noiseTexture({ size: 32, seed: 4, repeat: 2 })
  expect(b).not.toBe(a)
  expect(pixels(b)).toEqual(pixels(a))
  expect(b.repeat.toArray()).toEqual([2, 2])
  expect(pixels(noiseTexture({ size: 32, seed: 5 }))).not.toEqual(pixels(a))
  const plain = noiseTexture()
  expect(plain.image.width).toBe(64)
  expect(plain.colorSpace).toBe(NoColorSpace)
  expect(plain.wrapS).toBe(RepeatWrapping)
  expect(plain.generateMipmaps).toBe(true)
  expect(plain.minFilter).toBe(LinearMipmapLinearFilter)
  expect(noiseTexture({ srgb: true }).colorSpace).toBe(SRGBColorSpace)
})

test('noise stays within its range', () => {
  const data = pixels(noiseTexture({ size: 32, min: 0.8, max: 0.9, seed: 7 }))
  const values: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    expect(data[i + 1]).toBe(data[i])
    expect(data[i + 2]).toBe(data[i])
    expect(data[i + 3]).toBe(255)
    values.push(data[i])
  }
  expect(Math.min(...values)).toBeGreaterThanOrEqual(Math.round(0.8 * 255))
  expect(Math.max(...values)).toBeLessThanOrEqual(Math.round(0.9 * 255))
  expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(5)
})

test('speckle starts from its base colour and repeats', () => {
  const options = { base: tints.potGlazes.terracotta, dots: tints.potDots.terracotta, seed: 5, size: 64, count: 200 }
  const texture = speckleTexture(options)
  expect(speckleTexture({ ...options })).toBe(texture)
  const data = pixels(texture)
  const hex = new Color(tints.potGlazes.terracotta).getHex()
  const base = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
  let plain = 0
  for (let i = 0; i < data.length; i += 4) if (data[i] === base[0] && data[i + 1] === base[1] && data[i + 2] === base[2]) plain++
  const total = data.length / 4
  expect(plain / total).toBeGreaterThan(0.6)
  expect(plain).toBeLessThan(total)
  expect(texture.colorSpace).toBe(SRGBColorSpace)
  expect(texture.wrapS).toBe(RepeatWrapping)
  expect(texture.wrapT).toBe(RepeatWrapping)
  expect(texture.repeat.toArray()).toEqual([3, 1])
  expect(speckleTexture({ ...options, repeat: [2, 1] }).repeat.toArray()).toEqual([2, 1])
})

test('the normal noise is a tangent-space normal map of the same noise: unit vectors, flat on average, never constant', () => {
  const texture = normalNoiseTexture({ size: 32, seed: 4, strength: 2 })
  expect(normalNoiseTexture({ size: 32, seed: 4, strength: 2 })).toBe(texture)
  expect(texture.colorSpace).toBe(NoColorSpace)
  expect(texture.wrapS).toBe(RepeatWrapping)
  expect(texture.generateMipmaps).toBe(true)
  const data = pixels(texture)
  let x = 0
  let y = 0
  let z = 0
  let steepest = 0
  for (let i = 0; i < data.length; i += 4) {
    const v = [data[i] / 255 * 2 - 1, data[i + 1] / 255 * 2 - 1, data[i + 2] / 255 * 2 - 1]
    // Unit length, up to the rounding of 8 bits; pointing out of the surface.
    expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 1)
    expect(v[2]).toBeGreaterThan(0)
    expect(data[i + 3]).toBe(255)
    x += v[0]
    y += v[1]
    z += v[2]
    steepest = Math.max(steepest, Math.hypot(v[0], v[1]))
  }
  const count = data.length / 4
  // Flat on average (a tangent-space map leans no way), but with some relief.
  expect(Math.abs(x / count)).toBeLessThan(0.05)
  expect(Math.abs(y / count)).toBeLessThan(0.05)
  expect(z / count).toBeGreaterThan(0.8)
  expect(steepest).toBeGreaterThan(0.15)
  // Another seed, another relief; a stronger one leans more.
  expect(pixels(normalNoiseTexture({ size: 32, seed: 5, strength: 2 }))).not.toEqual(data)
  const strong = pixels(normalNoiseTexture({ size: 32, seed: 4, strength: 6 }))
  let strongZ = 0
  for (let i = 0; i < strong.length; i += 4) strongZ += strong[i + 2] / 255 * 2 - 1
  expect(strongZ / count).toBeLessThan(z / count)
  expect(normalNoiseTexture({ size: 32, seed: 4, strength: 2, repeat: 3 }).repeat.toArray()).toEqual([3, 3])
})
