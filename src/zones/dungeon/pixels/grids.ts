import { ellipse, noise, paint, peak, rect, union } from './shapes'

export { PALETTES, TINT_COLOURS } from './palette'
export { ADA_GRID, BOSS_GRIDS, GUARDIAN_SPRITES } from './sprites'

const SIZE = 16
const all = () => true

/** Stone bricks, 8 x 4, every other row offset by half a brick; dark mortar, speckled stone. */
const wall = paint(SIZE, [
  { shape: all, letter: (x, y) => (noise(x, y, 11) < 12 ? 'g' : noise(x, y, 5) < 5 ? 'b' : 's') },
  // A lighter top edge on each brick, then the mortar.
  { shape: (_x, y) => y % 4 === 0, letter: 'g' },
  { shape: (x, y) => y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7, letter: 'k' },
])

/** Spec 3, §3.2: the walls, floors and ceilings (16 x 16). */
export const TEXTURES = {
  wall,
  // Big flagstones with ink joints.
  floor: paint(SIZE, [
    { shape: all, letter: (x, y) => (noise(x, y, 23) < 18 ? 'd' : 's') },
    { shape: (x, y) => x % 8 === 0 || y % 8 === 0, letter: 'k' },
  ]),
  ceiling: paint(SIZE, [{ shape: all, letter: (x, y) => (noise(x, y, 31) < 12 ? 'k' : 'd') }]),
  // A wall carved with mint runes: an inscription to read.
  inscription: paint(SIZE, [
    { shape: all, letter: (x, y) => wall[y][x] },
    { shape: union(rect(3, 4, 3, 10), rect(3, 7, 6, 7), rect(9, 4, 12, 4), rect(10, 5, 10, 10), rect(12, 8, 12, 10)), letter: 'm' },
  ]),
}

/** A teardrop flame: round at the bottom, a tip that sways with the frame. */
const flame = (frame: number, scale: number) => {
  const sway = [0, 1, -1][frame]
  return union(ellipse(8, 7, 2.6 * scale, 2.4 * scale), peak(8 + sway, 7 - 6 * scale, 8 - 2.2 * scale, 8 + 2.2 * scale, 7))
}

/** A wall torch in three frames: a stick and a swaying flame on a transparent background. */
export const TORCH_FRAMES: string[][] = [0, 1, 2].map((frame) =>
  paint(SIZE, [
    { shape: rect(7, 10, 8, 15), letter: 'g' },
    { shape: rect(5, 9, 10, 10), letter: 'd' },
    { shape: flame(frame, 1), letter: 'w' },
    { shape: flame(frame, 0.5), letter: 'o' },
  ]),
)
