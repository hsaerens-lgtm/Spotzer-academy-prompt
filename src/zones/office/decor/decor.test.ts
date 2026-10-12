import { MODELS, modelUrl, type ModelId } from '../../../three/assets'
import { OBJECT_NAMES, resolveObject, type ObjectName } from '../../../three/objects'
import { plantGeometry } from '../../../three/plants/plantGeometry'
import { SIZES } from '../footprints'
import { BANQUETTE, GLAZING, SHELVES, layout } from '../layout'
import { RIM_INSET, VASE_HEIGHTS, vasePlantPosition } from './Vases'

/** Outer radius of a generated pot: its rim is 7 % wider than its body (three/plants/plantGeometry.ts). */
const rimRadius = (r: number) => r * 1.07

test('banquette plants stand on the banquette', () => {
  const onBanquette = layout.objects.plants.filter((plant) => plant.position[0] < BANQUETTE.x1)
  expect(onBanquette).toHaveLength(5)
  for (const plant of onBanquette) {
    const [x, y, z] = plant.position
    const r = rimRadius(plant.r)
    expect(y, plant.kind).toBe(BANQUETTE.height)
    expect(x - r).toBeGreaterThanOrEqual(BANQUETTE.x0)
    expect(x + r).toBeLessThanOrEqual(BANQUETTE.x1)
    expect(z - r).toBeGreaterThanOrEqual(BANQUETTE.z0)
    expect(z + r).toBeLessThanOrEqual(BANQUETTE.z1)
  }
  const round = layout.objects.vases.find((vase) => vase.model === 'vaseRound')!
  const half = SIZES.vaseRound[0] / 2
  expect(round.position[1]).toBe(BANQUETTE.height)
  expect(round.position[0] - half).toBeGreaterThanOrEqual(BANQUETTE.x0)
  expect(round.position[0] + half).toBeLessThanOrEqual(BANQUETTE.x1)
})

test('banquette plants keep their leaves inside the glazing', () => {
  // The inner face of the facade frame (mullions and transom): no generated leaf reaches it, nor the glass behind it.
  const frame = GLAZING.side.x + GLAZING.mullion.depth / 2
  const onBanquette = [
    ...layout.objects.plants.filter((plant) => plant.position[0] < BANQUETTE.x1),
    ...layout.objects.vases
      .filter((vase) => vase.position[0] < BANQUETTE.x1)
      .map((vase) => ({ ...vase.plant, pot: 'none' as const, position: vasePlantPosition(vase) })),
  ]
  expect(onBanquette).toHaveLength(6)
  for (const { kind, position, r, h, pot, scale, seed, fall, reach } of onBanquette) {
    const { canopy } = plantGeometry(kind, { r, h, pot, scale, seed, fall, reach })
    canopy.computeBoundingBox()
    expect(position[0] + canopy.boundingBox!.min.x, `${kind} at z ${position[2]}`).toBeGreaterThan(frame)
  }
})

test('shelf plants and books stand on a shelf board', () => {
  const [sx, , sz] = layout.objects.shelves.position
  const tops = SHELVES.boards.map((bottom) => bottom + SHELVES.thickness)
  const span = { x0: sx - SHELVES.width / 2, x1: sx + SHELVES.width / 2, z0: sz - SHELVES.depth / 2, z1: sz + SHELVES.depth / 2 }
  const onShelves = layout.objects.plants.filter((plant) => plant.position[1] > 1)
  expect(onShelves).toHaveLength(2)
  for (const plant of onShelves) {
    const [x, y, z] = plant.position
    const r = rimRadius(plant.r)
    expect(tops, plant.kind).toContain(y)
    expect(x - r).toBeGreaterThanOrEqual(span.x0)
    expect(x + r).toBeLessThanOrEqual(span.x1)
    expect(z - r).toBeGreaterThanOrEqual(span.z0)
    expect(z + r).toBeLessThanOrEqual(span.z1)
  }
  for (const books of layout.objects.shelfBooks) {
    expect(tops).toContain(books.y)
    expect(books.z).toBe(sz)
    expect(books.x0).toBeGreaterThanOrEqual(span.x0)
    expect(books.x1).toBeLessThanOrEqual(span.x1)
    // Books and pots never share the same stretch of a board.
    for (const plant of onShelves.filter((p) => p.position[1] === books.y)) {
      const r = rimRadius(plant.r)
      expect(plant.position[0] + r <= books.x0 || plant.position[0] - r >= books.x1, `${plant.kind} and books at ${books.y}`).toBe(true)
    }
  }
})

test('vase plants sit at the rim of their vase', () => {
  expect(layout.objects.vases).toHaveLength(2)
  for (const vase of layout.objects.vases) {
    const height = VASE_HEIGHTS[vase.model]
    // The footprint box is the vase plus a centimetre of margin.
    expect(height).toBeLessThanOrEqual(SIZES[vase.model][1])
    expect(height).toBeGreaterThan(SIZES[vase.model][1] - 0.02)
    const [x, y, z] = vasePlantPosition(vase)
    expect([x, z]).toEqual([vase.position[0], vase.position[2]])
    expect(y).toBeCloseTo(vase.position[1] + height - RIM_INSET, 9)
    expect('pot' in vase.plant).toBe(false)
  }
  // The tall vase stands on the sideboard top, the round one on the banquette.
  const tall = layout.objects.vases.find((vase) => vase.model === 'vaseTall')!
  expect(tall.position[1]).toBe(SIZES.sideboard[1])
})

test('every d\u00e9cor model is declared in the registry', () => {
  const decorModels: [ObjectName, ModelId][] = [
    ['cabinet', 'drawerCabinet'],
    ['coffeeTable', 'coffeeTable'],
    ['pendant', 'pendantLamp'],
    ['pictureFrame', 'pictureFrame'],
    ['pottedPlant', 'pottedPlant'],
    ['pachira', 'pachira'],
    ['vaseTall', 'vaseTall'],
    ['vaseRound', 'vaseRound'],
    ['clayPot', 'clayPot'],
  ]
  for (const [name, model] of decorModels) {
    expect(OBJECT_NAMES, name).toContain(name)
    expect(resolveObject(name), name).toEqual({ kind: 'glb', url: modelUrl(model) })
    expect(MODELS[model].stage, name).toBe('decor')
  }
})
