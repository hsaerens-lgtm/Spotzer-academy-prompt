import type { BossSprite, Sprite } from '../../../dungeon/model'
import { circle, ellipse, minus, mirrorX, noise, paint, peak, rect, union } from './shapes'

/** Eyes: two small ovals, mirrored around the sprite's centre. */
const eyes = (size: number, x: number, y: number, r = 1.6) => mirrorX(size, ellipse(x, y, r, r * 1.2))

/** Spec 3, §3.3: nine 32 x 32 guardians, front-facing. "T" is the guardian's tint. */
export const GUARDIAN_SPRITES: Record<Sprite, string[]> = {
  knight: paint(
    32,
    [
      { shape: union(ellipse(16, 11, 7.5, 8), rect(9, 11, 22, 15)), letter: 'g' },
      { shape: peak(16, 1, 14, 18, 5), letter: 'T' },
      { shape: rect(10, 10, 21, 11), letter: 'k' },
      { shape: eyes(32, 13, 10.5, 1.2), letter: 'l' },
      { shape: union(rect(8, 17, 23, 26), ellipse(16, 17, 8, 3)), letter: 'T' },
      { shape: union(rect(15, 18, 16, 25), rect(11, 21, 20, 22)), letter: 'o' },
      { shape: union(rect(10, 27, 13, 31), rect(18, 27, 21, 31)), letter: 'g' },
    ],
    { outline: true },
  ),
  mimic: paint(
    32,
    [
      { shape: rect(4, 15, 27, 29), letter: 'T' },
      { shape: union(rect(4, 6, 27, 11), rect(5, 5, 26, 5)), letter: 'T' },
      { shape: union(rect(4, 20, 27, 21), rect(15, 6, 16, 29)), letter: 'g' },
      { shape: rect(5, 12, 26, 14), letter: 'k' },
      { shape: (x, y) => (y === 12 && x % 3 === 0 && x > 5 && x < 26) || (y === 14 && x % 3 === 1 && x > 5 && x < 26), letter: 'o' },
      { shape: ellipse(16, 14, 4, 1.5), letter: 'w' },
      { shape: eyes(32, 10, 8.5, 1.4), letter: 'l' },
    ],
    { outline: true },
  ),
  eye: paint(
    32,
    [
      { shape: union(rect(15, 25, 16, 31), rect(9, 26, 10, 31), rect(21, 26, 22, 31)), letter: 'g' },
      { shape: circle(16, 15, 12), letter: 'o' },
      { shape: circle(16, 15, 6.5), letter: 'T' },
      { shape: circle(16, 15, 3), letter: 'k' },
      { shape: circle(14, 13, 1.2), letter: 'o' },
      { shape: union(rect(5, 6, 9, 7), rect(23, 6, 27, 7)), letter: 'g' },
    ],
    { outline: true },
  ),
  goblin: paint(
    32,
    [
      { shape: union(peak(3, 6, 3, 11, 13), peak(28, 6, 20, 28, 13)), letter: 'T' },
      { shape: ellipse(16, 13, 9, 8), letter: 'T' },
      { shape: eyes(32, 12.5, 11, 1.8), letter: 'w' },
      { shape: rect(12, 16, 19, 17), letter: 'k' },
      { shape: (x, y) => y === 16 && (x === 13 || x === 18), letter: 'o' },
      { shape: union(rect(10, 21, 21, 28), ellipse(16, 21, 6, 2)), letter: 'd' },
      { shape: rect(13, 22, 18, 25), letter: 'w' },
      { shape: union(rect(11, 29, 13, 31), rect(18, 29, 20, 31)), letter: 'T' },
    ],
    { outline: true },
  ),
  hoarder: paint(
    32,
    [
      { shape: ellipse(16, 28, 14, 5), letter: (x, y) => (noise(x, y, 3) < 30 ? 'o' : 'w') },
      { shape: ellipse(16, 17, 9, 9), letter: 'T' },
      { shape: union(peak(10, 3, 8, 12, 10), peak(22, 3, 20, 24, 10)), letter: 'g' },
      { shape: eyes(32, 12.5, 15, 1.6), letter: 'k' },
      { shape: ellipse(16, 21, 4, 1.6), letter: 'k' },
      { shape: union(ellipse(6, 21, 3, 5), ellipse(26, 21, 3, 5)), letter: 'T' },
    ],
    { outline: true },
  ),
  ghost: paint(
    32,
    [
      { shape: union(ellipse(16, 13, 10, 10), minus(rect(6, 13, 25, 28), (x, y) => y > 25 && x % 6 < 3)), letter: 'T' },
      { shape: eyes(32, 12, 12, 2.2), letter: 'k' },
      { shape: ellipse(16, 19, 3, 2), letter: 'k' },
      { shape: union(rect(3, 16, 6, 18), rect(25, 16, 28, 18)), letter: 'T' },
    ],
    { outline: true },
  ),
  sphinx: paint(
    32,
    [
      { shape: ellipse(16, 25, 14, 5.5), letter: 'T' },
      { shape: union(rect(3, 25, 8, 30), rect(23, 25, 28, 30)), letter: 'T' },
      { shape: peak(16, 2, 6, 26, 18), letter: (_x, y) => (y % 3 === 0 ? 'w' : 'g') },
      { shape: ellipse(16, 13, 5.5, 6.5), letter: 'T' },
      { shape: eyes(32, 13.5, 12, 1.2), letter: 'k' },
      { shape: rect(15, 16, 16, 17), letter: 'k' },
    ],
    { outline: true },
  ),
  slime: paint(
    32,
    [
      { shape: minus(ellipse(16, 24, 13, 11), rect(0, 29, 31, 31)), letter: 'T' },
      { shape: ellipse(16, 28, 13, 1.5), letter: 'T' },
      { shape: ellipse(10, 18, 2.5, 1.5), letter: 'o' },
      { shape: eyes(32, 12.5, 22, 1.8), letter: 'k' },
      { shape: ellipse(16, 26, 3, 1), letter: 'k' },
    ],
    { outline: true },
  ),
  wraith: paint(
    32,
    [
      { shape: minus(peak(16, 2, 4, 28, 30), (x, y) => y > 27 && x % 5 < 2), letter: 'T' },
      { shape: ellipse(16, 11, 5, 5.5), letter: 'k' },
      { shape: eyes(32, 14, 11, 1.1), letter: 'l' },
      { shape: union(rect(4, 17, 8, 19), rect(23, 17, 27, 19)), letter: 'd' },
    ],
    { outline: true },
  ),
}

/** Spec 3, §3.4 and §3.6: the two bosses, 64 x 64. */
export const BOSS_GRIDS: Record<BossSprite, string[]> = {
  // The Vague Prompt: a golem of taped cardboard boxes.
  golem: paint(
    64,
    [
      { shape: union(rect(16, 4, 47, 22), rect(8, 24, 55, 46), rect(12, 48, 27, 63), rect(36, 48, 51, 63)), letter: (x, y) => (noise(x, y, 7) < 12 ? 'g' : 'w') },
      { shape: union(rect(0, 26, 7, 38), rect(56, 26, 63, 38)), letter: 'w' },
      { shape: union(rect(30, 4, 33, 22), rect(8, 34, 55, 36), rect(18, 48, 21, 63), rect(42, 48, 45, 63)), letter: 'o' },
      { shape: union(rect(22, 10, 27, 14), rect(36, 10, 41, 14)), letter: 'k' },
      { shape: rect(26, 17, 37, 18), letter: 'k' },
      { shape: union(rect(16, 22, 47, 23), rect(8, 46, 55, 47)), letter: 'd' },
    ],
    { outline: true },
  ),
  // The Leaky Agent: a cracked robot whose instructions drip out.
  agent: paint(
    64,
    [
      { shape: union(rect(14, 6, 49, 30), rect(10, 32, 53, 56), rect(18, 57, 25, 63), rect(38, 57, 45, 63)), letter: 'g' },
      { shape: union(rect(2, 34, 9, 50), rect(54, 34, 61, 50)), letter: 'g' },
      { shape: rect(18, 10, 45, 26), letter: 'k' },
      { shape: union(rect(23, 15, 27, 19), rect(36, 15, 40, 19)), letter: 'l' },
      { shape: rect(26, 22, 37, 23), letter: 'l' },
      { shape: (x, y) => y >= 32 && y <= 56 && (x === 22 || x === 31 || x === 40) && (y + x) % 4 !== 0, letter: 'm' },
      { shape: (x, y) => x >= 20 && x <= 44 && y >= 57 && y <= 63 && x % 6 === 2, letter: 'm' },
      { shape: (x, y) => Math.abs(x - 15 - (y - 32) * 0.3) < 0.6 && y >= 32 && y < 45, letter: 'k' },
      { shape: rect(28, 38, 35, 44), letter: 'b' },
    ],
    { outline: true },
  ),
}

/** Ada, 48 x 48: the same silhouette as the workshop's 2D Ada (porcelain drop, oval head, black visor, lime eyes). */
export const ADA_GRID = paint(
  48,
  [
    { shape: union(ellipse(24, 34, 11, 12), peak(24, 22, 14, 34, 34)), letter: 'o' },
    { shape: union(ellipse(10, 32, 3, 7), ellipse(38, 32, 3, 7)), letter: 'o' },
    { shape: rect(13, 31, 35, 31), letter: 'm' },
    { shape: ellipse(24, 13, 12, 10), letter: 'o' },
    { shape: ellipse(24, 14, 9, 6), letter: 'k' },
    { shape: union(ellipse(19.5, 14, 2, 1.6), ellipse(28.5, 14, 2, 1.6)), letter: 'l' },
  ],
  { outline: true },
)
