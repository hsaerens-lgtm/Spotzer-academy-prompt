import { SPRITES } from '../../../dungeon/model'
import { ADA_GRID, BOSS_GRIDS, GUARDIAN_SPRITES, PALETTES, TEXTURES, TORCH_FRAMES } from './grids'

const check = (name: string, grid: string[], size: number, letters: string) => {
  expect(grid, name).toHaveLength(size)
  for (const row of grid) expect(row, name).toHaveLength(size)
  for (const letter of new Set(grid.join(''))) expect(letters.includes(letter), `${name}: "${letter}"`).toBe(true)
  // Not an empty or a blank square: a real silhouette.
  const filled = [...grid.join('')].filter((c) => c !== '.').length
  expect(filled, `${name} is too empty`).toBeGreaterThan(size)
}

test('every grid has its size and only palette letters ("." is transparent, "T" the tint)', () => {
  const letters = `.T${Object.keys(PALETTES[1]).join('')}`
  for (const [name, grid] of Object.entries(TEXTURES)) check(name, grid, 16, letters)
  TORCH_FRAMES.forEach((grid, i) => check(`torch ${i}`, grid, 16, letters))
  for (const sprite of SPRITES) check(sprite, GUARDIAN_SPRITES[sprite], 32, letters)
  for (const [name, grid] of Object.entries(BOSS_GRIDS)) check(name, grid, 64, letters)
  check('ada', ADA_GRID, 48, letters)
})

test('walls, floors and ceilings are opaque; sprites have a transparent background', () => {
  for (const [name, grid] of Object.entries(TEXTURES)) expect(grid.join('').includes('.'), name).toBe(false)
  for (const sprite of SPRITES) expect(GUARDIAN_SPRITES[sprite][0][0], sprite).toBe('.')
})

test('guardians use their tint, and no two guardian shapes are the same', () => {
  for (const sprite of SPRITES) expect(GUARDIAN_SPRITES[sprite].join('').includes('T'), sprite).toBe(true)
  expect(new Set(SPRITES.map((sprite) => GUARDIAN_SPRITES[sprite].join(''))).size).toBe(SPRITES.length)
})

test('both floors define the same letters', () => {
  expect(Object.keys(PALETTES[2]).sort()).toEqual(Object.keys(PALETTES[1]).sort())
})
