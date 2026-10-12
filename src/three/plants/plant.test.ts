import { Box3, Color, DoubleSide, type BufferGeometry } from 'three'
import { SIZES } from '../../zones/office/footprints'
import { layout } from '../../zones/office/layout'
import { isTextured } from '../audit'
import { ENV_MAP_INTENSITY } from '../materials'
import { tints } from '../tints'
import { plantGeometry, type PlantGeometry } from './plantGeometry'
import { plantMaterials } from './plantMaterials'
import type { PlantKind } from './types'

/** zones/office/footprints.ts: pothos vines may hang this far (x scale) below the pot (`below` of boxFor). */
const BELOW: Partial<Record<PlantKind, number>> = { pothos: 0.6 }
const KINDS: PlantKind[] = ['monstera', 'palm', 'fern', 'pothos', 'succulent', 'herb']

const positions = (geometry: BufferGeometry) => Array.from(geometry.getAttribute('position').array)
function bounds(plant: PlantGeometry): Box3 {
  const box = new Box3().setFromBufferAttribute(plant.canopy.getAttribute('position') as never)
  if (plant.pot) box.union(new Box3().setFromBufferAttribute(plant.pot.getAttribute('position') as never))
  return box
}
const key = (r: number, g: number, b: number) => [r, g, b].map((n) => n.toFixed(5)).join(',')
const colourKey = (colour: string) => {
  const c = new Color(colour)
  return key(c.r, c.g, c.b)
}

test('a plant is the same on every run', async () => {
  const options = { r: 0.16, h: 0.22, pot: 'cream' as const, scale: 0.9, seed: 11 }
  const first = plantGeometry('monstera', options)
  expect(plantGeometry('monstera', { ...options })).toBe(first)
  // A fresh module (empty cache) with a rigged Math.random builds the very same plant: only Horn.os' LCG decides.
  vi.resetModules()
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const again = (await import('./plantGeometry')).plantGeometry('monstera', options)
  random.mockRestore()
  expect(again).not.toBe(first)
  expect(positions(again.canopy)).toEqual(positions(first.canopy))
  expect(positions(again.pot!)).toEqual(positions(first.pot!))
  expect(positions(plantGeometry('monstera', { ...options, seed: 12 }).canopy)).not.toEqual(positions(first.canopy))
})

test('each kind stays within its footprint', () => {
  // Every plant of the layout, with its own seed and 24 others: the footprints keep the laptop and the retro corner clear.
  for (const [index, placement] of layout.objects.plants.entries()) {
    const [w, h, d] = SIZES[placement.kind].map((n) => n * placement.scale)
    const below = (BELOW[placement.kind] ?? 0) * placement.scale
    for (const seed of [placement.seed, ...Array.from({ length: 24 }, (_, i) => i + 1)]) {
      const box = bounds(plantGeometry(placement.kind, { ...placement, seed }))
      const label = `plant-${index} (${placement.kind}) seed ${seed}`
      expect(Math.max(-box.min.x, box.max.x), label).toBeLessThanOrEqual(w / 2)
      expect(Math.max(-box.min.z, box.max.z), label).toBeLessThanOrEqual(d / 2)
      expect(box.max.y, label).toBeLessThanOrEqual(h)
      expect(box.min.y, label).toBeGreaterThanOrEqual(-below - 1e-9)
    }
  }
})

test('a potless plant has no pot', () => {
  const soil = colourKey(tints.soil)
  const potless = plantGeometry('fern', { r: 0.08, h: 0.1, pot: 'none', scale: 0.6, seed: 73 })
  expect(potless.pot).toBeNull()
  const colours = potless.canopy.getAttribute('color')
  for (let i = 0; i < colours.count; i++) expect(key(colours.getX(i), colours.getY(i), colours.getZ(i))).not.toBe(soil)
  const potted = plantGeometry('fern', { r: 0.08, h: 0.1, pot: 'slate', scale: 0.6, seed: 73 })
  expect(potted.pot).not.toBeNull()
  const pot = new Box3().setFromBufferAttribute(potted.pot!.getAttribute('position') as never)
  expect(pot.min.y).toBeCloseTo(0, 6)
  expect(pot.max.y).toBeCloseTo(0.1, 6)
  // Without a pot the plant grows from the origin, so it can stand on a vase's rim.
  expect(new Box3().setFromBufferAttribute(potless.canopy.getAttribute('position') as never).max.y).toBeLessThan(
    new Box3().setFromBufferAttribute(potted.canopy.getAttribute('position') as never).max.y,
  )
})

test('pothos vines fall toward their fall direction', () => {
  const h = 0.12
  for (const fall of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const seed of [31, 53, 71]) {
      const { canopy } = plantGeometry('pothos', { r: 0.1, h, pot: 'terracotta', scale: 1, seed, fall })
      const position = canopy.getAttribute('position')
      let x = 0
      let z = 0
      // Below the rim there are only vines: their mean horizontal offset points where they fall.
      for (let i = 0; i < position.count; i++) {
        if (position.getY(i) < h * 0.96 - 0.05) {
          x += position.getX(i)
          z += position.getZ(i)
        }
      }
      const angle = Math.atan2(x, z)
      const off = Math.abs(Math.atan2(Math.sin(angle - fall), Math.cos(angle - fall)))
      expect(off, `fall ${fall.toFixed(2)} seed ${seed}`).toBeLessThan(0.9)
    }
  }
})

test('the canopy carries leaf colours and UVs', () => {
  const allowed = new Set([...tints.leafGreens, tints.stem, tints.soil].map(colourKey))
  const greens = new Set(tints.leafGreens.map(colourKey))
  for (const kind of KINDS) {
    const { canopy } = plantGeometry(kind, { r: 0.12, h: 0.14, pot: 'terracotta', scale: 1, seed: 7 })
    const count = canopy.getAttribute('position').count
    expect(canopy.getAttribute('uv').count, kind).toBe(count)
    const colours = canopy.getAttribute('color')
    expect(colours.count, kind).toBe(count)
    const seen = new Set<string>()
    for (let i = 0; i < count; i++) {
      const k = key(colours.getX(i), colours.getY(i), colours.getZ(i))
      expect(allowed.has(k), `${kind}: ${k}`).toBe(true)
      if (greens.has(k)) seen.add(k)
    }
    expect(seen.size, kind).toBeGreaterThanOrEqual(2)
  }
})

test('every plant material is textured', () => {
  const m = plantMaterials()
  expect(plantMaterials()).toBe(m)
  const all = [m.canopy, m.cord, ...Object.values(m.pots), ...Object.values(m.hangingPots)]
  expect(all).toHaveLength(10)
  for (const material of all) expect(isTextured(material), material.name).toBe(true)
  expect(m.canopy).toMatchObject({ vertexColors: true, side: DoubleSide, roughness: 0.68, envMapIntensity: ENV_MAP_INTENSITY.plant })
  expect(m.pots.brass.metalness).toBe(0.7)
})

// Task 14 fix: a pothos on the edge of a bench or a board must hang past that edge, not through it.
test('pothos vines travel out to their reach before they hang', () => {
  const h = 0.12
  // A leaf reaches back toward the pot by its length (0.057 at most) and a vine wobbles 0.012 sideways.
  const LEAF_AND_WOBBLE = 0.057 + 0.012
  for (const reach of [0.15, 0.2]) {
    for (const fall of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      for (const seed of [31, 53, 71]) {
        const { canopy } = plantGeometry('pothos', { r: 0.1, h, pot: 'terracotta', scale: 1, seed, fall, reach })
        const position = canopy.getAttribute('position')
        let hanging = 0
        for (let i = 0; i < position.count; i++) {
          // Well under the rim there are only vines: all of them stand out past the reach along `fall`.
          if (position.getY(i) >= h * 0.96 - 0.1) continue
          hanging++
          const along = position.getX(i) * Math.sin(fall) + position.getZ(i) * Math.cos(fall)
          expect(along, `reach ${reach}, fall ${fall.toFixed(2)}, seed ${seed}`).toBeGreaterThanOrEqual(reach - LEAF_AND_WOBBLE - 1e-9)
        }
        expect(hanging).toBeGreaterThan(100)
      }
    }
  }
  // Without it the vines spill 6-13 cm and fall: some hang closer than that.
  const { canopy } = plantGeometry('pothos', { r: 0.1, h, pot: 'terracotta', scale: 1, seed: 31, fall: 0 })
  const position = canopy.getAttribute('position')
  const close = Array.from({ length: position.count }, (_, i) => i).filter((i) => position.getY(i) < h * 0.96 - 0.1 && position.getZ(i) < 0.2 - 0.069)
  expect(close.length).toBeGreaterThan(0)
})

test('the reach option changes only a pothos, and a plant without it is the plant it always was', () => {
  const fern = { r: 0.13, h: 0.16, pot: 'slate' as const, scale: 0.95, seed: 23 }
  expect(positions(plantGeometry('fern', { ...fern, reach: 0.3 }).canopy)).toEqual(positions(plantGeometry('fern', fern).canopy))
  const monstera = { r: 0.16, h: 0.22, pot: 'cream' as const, scale: 0.7, seed: 11 }
  expect(positions(plantGeometry('monstera', { ...monstera, reach: 0.3 }).canopy)).toEqual(positions(plantGeometry('monstera', monstera).canopy))
  // A pothos without a reach: the vertices of Task 13's generator (vertex count, sum and weighted sum of the positions).
  const checksum = (geometry: BufferGeometry) => {
    const array = geometry.getAttribute('position').array
    let sum = 0
    let weighted = 0
    for (let i = 0; i < array.length; i++) {
      sum += array[i]
      weighted += array[i] * ((i % 7) + 1)
    }
    return [geometry.getAttribute('position').count, +sum.toFixed(6), +weighted.toFixed(6)]
  }
  expect(checksum(plantGeometry('pothos', { r: 0.08, h: 0.1, pot: 'none', scale: 0.8, seed: 71, fall: 0 }).canopy)).toEqual([5409, -508.177998, -2034.70432])
  expect(checksum(plantGeometry('monstera', monstera).canopy)).toEqual([2622, 1165.534446, 4655.964181])
  expect(checksum(plantGeometry('fern', fern).canopy)).toEqual([10260, 1870.98557, 7484.032436])
})
