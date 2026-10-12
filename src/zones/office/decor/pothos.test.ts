import type { BufferGeometry } from 'three'
import { plantGeometry } from '../../../three/plants/plantGeometry'
import type { PlantPlacement } from '../../../three/plants/types'
import { BANQUETTE, SHELVES, layout } from '../layout'

/*
 * The two pothos stand on the edge of what carries them, so their vines must hang past that edge: not into the bench
 * or through the board, which is what the generator's default spill (6-13 cm, then straight down) does from a pot that
 * stands 11 cm or more from the edge (Task 14 review).
 */

/** The canopy's vertices in world space (a plant is not turned). */
function world(placement: PlantPlacement): [number, number, number][] {
  const { kind, position, r, h, pot, scale, seed, fall, reach } = placement
  const geometry: BufferGeometry = plantGeometry(kind, { r, h, pot, scale, seed, fall, reach }).canopy
  const attribute = geometry.getAttribute('position')
  return Array.from({ length: attribute.count }, (_, i) => [position[0] + attribute.getX(i), position[1] + attribute.getY(i), position[2] + attribute.getZ(i)])
}

const [sx, , sz] = layout.objects.shelves.position
const [, high] = SHELVES.boards
const bench = layout.objects.plants.filter((plant) => plant.kind === 'pothos' && plant.position[0] < BANQUETTE.x1)
const board = layout.objects.plants.filter((plant) => plant.kind === 'pothos' && plant.position[1] > 1)
const boardBox = { x0: sx - SHELVES.width / 2, x1: sx + SHELVES.width / 2, z0: sz - SHELVES.depth / 2, z1: sz + SHELVES.depth / 2, y0: high, y1: high + SHELVES.thickness }

test('there is one pothos on the banquette and one on the high board', () => {
  expect(bench).toHaveLength(1)
  expect(board).toHaveLength(1)
})

test('no vine of the banquette pothos goes into the bench', () => {
  const inside = world(bench[0]).filter(
    ([x, y, z]) => y < BANQUETTE.height - 1e-6 && x > BANQUETTE.x0 && x < BANQUETTE.x1 && z > BANQUETTE.z0 && z < BANQUETTE.z1,
  )
  expect(inside).toHaveLength(0)
})

test('no vine of the high-board pothos goes through the board', () => {
  const inside = world(board[0]).filter(
    ([x, y, z]) => y > boardBox.y0 + 1e-6 && y < boardBox.y1 - 1e-6 && x > boardBox.x0 && x < boardBox.x1 && z > boardBox.z0 && z < boardBox.z1,
  )
  expect(inside).toHaveLength(0)
})

// The vine tips: what hangs more than 5 cm below the top of the bench, or below the board's underside.
test('most of the vine tips hang past the front edge of their bench or board', () => {
  const benchTips = world(bench[0]).filter(([, y]) => y < BANQUETTE.height - 0.05)
  expect(benchTips.length).toBeGreaterThan(100)
  expect(benchTips.filter(([x]) => x >= BANQUETTE.x1).length / benchTips.length).toBeGreaterThanOrEqual(0.6)
  const boardTips = world(board[0]).filter(([, y]) => y < boardBox.y0 - 0.05)
  expect(boardTips.length).toBeGreaterThan(100)
  expect(boardTips.filter(([, , z]) => z >= boardBox.z1).length / boardTips.length).toBeGreaterThanOrEqual(0.6)
})

test('each pot stands fully on its support, at the front of it', () => {
  const rim = (plant: PlantPlacement) => plant.r * 1.07
  const [b] = bench
  expect(b.position[1]).toBe(BANQUETTE.height)
  expect(b.position[0] + rim(b)).toBeLessThanOrEqual(BANQUETTE.x1)
  expect(BANQUETTE.x1 - (b.position[0] + rim(b))).toBeLessThan(0.02)
  const [s] = board
  expect(s.position[1]).toBe(boardBox.y1)
  expect(s.position[2] + rim(s)).toBeLessThanOrEqual(boardBox.z1)
  expect(boardBox.z1 - (s.position[2] + rim(s))).toBeLessThan(0.02)
  expect(s.position[0] + rim(s)).toBeLessThanOrEqual(boardBox.x1)
})
