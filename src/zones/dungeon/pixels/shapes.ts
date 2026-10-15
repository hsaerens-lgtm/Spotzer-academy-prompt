/**
 * A tiny pixel painter: the dungeon's sprites and textures are grids of palette letters (spec 3, §4.4), drawn here
 * from simple shapes rather than typed by hand. "." is transparent.
 */
export type Shape = (x: number, y: number) => boolean
export interface Layer {
  shape: Shape
  /** A letter, or one chosen per pixel. */
  letter: string | ((x: number, y: number) => string)
}

export const ellipse =
  (cx: number, cy: number, rx: number, ry: number): Shape =>
  (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1
export const circle = (cx: number, cy: number, r: number): Shape => ellipse(cx, cy, r, r)
/** Inclusive pixel bounds. */
export const rect =
  (x0: number, y0: number, x1: number, y1: number): Shape =>
  (x, y) =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1
/** A triangle pointing up: apex (ax, top), base from (x0, bottom) to (x1, bottom). */
export const peak =
  (ax: number, top: number, x0: number, x1: number, bottom: number): Shape =>
  (x, y) => {
    if (y < top || y > bottom) return false
    const t = (y - top) / Math.max(1, bottom - top)
    return x >= ax + (x0 - ax) * t - 0.5 && x <= ax + (x1 - ax) * t + 0.5
  }
export const union =
  (...shapes: Shape[]): Shape =>
  (x, y) =>
    shapes.some((s) => s(x, y))
export const minus =
  (shape: Shape, cut: Shape): Shape =>
  (x, y) =>
    shape(x, y) && !cut(x, y)
export const mirrorX =
  (size: number, shape: Shape): Shape =>
  (x, y) =>
    shape(x, y) || shape(size - 1 - x, y)

/** Deterministic noise in [0, 100), for stone speckles. */
export const noise = (x: number, y: number, seed = 1) => (((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0) % 100

/** Paints layers in order (later ones on top); `outline` rings the silhouette with ink for readability. */
export function paint(size: number, layers: Layer[], { outline = false, background = '.' } = {}): string[] {
  const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => background))
  for (const { shape, letter } of layers) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) if (shape(x, y)) grid[y][x] = typeof letter === 'string' ? letter : letter(x, y)
    }
  }
  if (outline) {
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && grid[y][x] !== '.'
    const ring: [number, number][] = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[y][x] === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) ring.push([x, y])
      }
    }
    for (const [x, y] of ring) grid[y][x] = 'k'
  }
  return grid.map((row) => row.join(''))
}
