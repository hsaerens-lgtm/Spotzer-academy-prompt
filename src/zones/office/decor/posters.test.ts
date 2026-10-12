import { BufferAttribute, Texture, Vector2 } from 'three'
import { brand } from '../../../core/brand'
import { tints } from '../../../three/tints'
import { POSTER_COLOURS, fitToUvRect, posterDesign, uvRect } from './posters'

const SEEDS = [101, 103, 1, 7, 42, 2026]

test('posters use only brand colours on paper', () => {
  for (const seed of SEEDS) {
    const { paper, shapes } = posterDesign(seed)
    expect(paper).toBe(tints.posterPaper)
    expect(shapes.length, `seed ${seed}`).toBeGreaterThanOrEqual(5)
    expect(shapes.length, `seed ${seed}`).toBeLessThanOrEqual(9)
    for (const shape of shapes) {
      expect(POSTER_COLOURS).toContain(shape.colour)
      expect(brand[shape.colour]).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(['rect', 'circle']).toContain(shape.kind)
      // Inside the sheet.
      expect(shape.x).toBeGreaterThanOrEqual(0)
      expect(shape.y).toBeGreaterThanOrEqual(0)
      expect(shape.w).toBeGreaterThan(0)
      expect(shape.h).toBeGreaterThan(0)
      expect(shape.x + shape.w).toBeLessThanOrEqual(1)
      expect(shape.y + shape.h).toBeLessThanOrEqual(1)
    }
  }
})

test('posters are the same on every run', () => {
  expect(posterDesign(101)).toEqual(posterDesign(101))
  expect(posterDesign(103)).toEqual(posterDesign(103))
})

test('the two frames show different posters', () => {
  expect(posterDesign(101)).not.toEqual(posterDesign(103))
})

// hanging_picture_frame_01's artwork samples only the middle of its square image (u 0.165 to 0.835, v 0.002 to 0.998):
// as it comes, a poster would lose a sixth on each side and show its disc a half wider than tall.
test('a poster fills the UV rectangle of the artwork it hangs on, corner to corner', () => {
  const uv = new BufferAttribute(new Uint16Array([10813, 131, 54722, 131, 54722, 65404, 10813, 65404]), 2, true)
  const rect = uvRect(uv)
  expect(rect.map((value) => +value.toFixed(3))).toEqual([0.165, 0.002, 0.835, 0.998])
  const texture = new Texture()
  fitToUvRect(texture, rect)
  texture.updateMatrix()
  const sample = (u: number, v: number) => new Vector2(u, v).applyMatrix3(texture.matrix)
  expect(sample(rect[0], rect[1]).x).toBeCloseTo(0)
  expect(sample(rect[0], rect[1]).y).toBeCloseTo(0)
  expect(sample(rect[2], rect[3]).x).toBeCloseTo(1)
  expect(sample(rect[2], rect[3]).y).toBeCloseTo(1)
  expect(sample(0.5, 0.5).x).toBeCloseTo(0.5)
})
