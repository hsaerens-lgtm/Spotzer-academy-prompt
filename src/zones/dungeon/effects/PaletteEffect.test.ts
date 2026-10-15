import { PaletteEffect, paletteUniform } from './PaletteEffect'

test('the palette becomes sRGB vectors, padded to 16 entries with the last colour', () => {
  const vectors = paletteUniform(['#000000', '#FFFFFF'])
  expect(vectors).toHaveLength(16)
  const close = (v: number[], w: number[]) => v.forEach((x, i) => expect(x).toBeCloseTo(w[i], 4))
  close(vectors[0].toArray(), [0, 0, 0])
  close(vectors[1].toArray(), [1, 1, 1])
  close(vectors[15].toArray(), [1, 1, 1])
  // sRGB, not linear: mid grey stays near 0.5.
  close(paletteUniform(['#808080'])[0].toArray(), [128 / 255, 128 / 255, 128 / 255])
})

test('the effect carries its colour count and dither cell, and snaps to the palette in its shader', () => {
  const effect = new PaletteEffect({ colours: ['#0B0D0E', '#58FC73', '#F4F6F5'], cell: 4 })
  expect(effect.uniforms.get('athenaCount')!.value).toBe(3)
  expect(effect.uniforms.get('athenaCell')!.value).toBe(4)
  // Prefixed names: merged with Scanline (which has its own count) in one shader, plain names would collide.
  for (const name of effect.uniforms.keys()) expect(name).toMatch(/^athena/)
  expect(effect.uniforms.get('athenaScanlines')!.value).toBeGreaterThan(0)
})
