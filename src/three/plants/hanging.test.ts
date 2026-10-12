import { Box3 } from 'three'
import { SIZES } from '../../zones/office/footprints'
import { layout } from '../../zones/office/layout'
import { HANGING_POT, VINE_REACH, hangingGeometry, hangingVines } from './hanging'

test('a hanging plant hangs below its hook', () => {
  const [w, h, d] = SIZES.hangingPlant
  for (const placement of layout.objects.hangingPlants) {
    for (const seed of [placement.seed, 1, 2, 4, 5, 8]) {
      const plant = hangingGeometry({ ...placement, seed })
      const box = new Box3()
      for (const geometry of [plant.cords, plant.pot, plant.canopy]) box.union(new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never))
      const label = `${placement.glaze} seed ${seed}`
      // Nothing above the hook (the cords' end caps may tilt half a millimetre past it).
      expect(box.max.y, label).toBeLessThan(0.001)
      expect(box.min.y, label).toBeGreaterThanOrEqual(-h)
      expect(Math.max(-box.min.x, box.max.x), label).toBeLessThanOrEqual(w / 2)
      expect(Math.max(-box.min.z, box.max.z), label).toBeLessThanOrEqual(d / 2)
      const pot = new Box3().setFromBufferAttribute(plant.pot.getAttribute('position') as never)
      expect(pot.max.y, label).toBeCloseTo(-placement.drop, 6)
      expect(pot.max.y - pot.min.y, label).toBeCloseTo(HANGING_POT.h, 6)
    }
  }
  expect(hangingGeometry({ ...layout.objects.hangingPlants[0] })).toBe(hangingGeometry({ ...layout.objects.hangingPlants[0] }))
})

test('vines follow their count and length', () => {
  for (const { vines, length, drop, seed } of [
    { vines: 11, length: 0.9, drop: 0.55, seed: 3 },
    { vines: 9, length: 0.8, drop: 0.5, seed: 7 },
    { vines: 4, length: 0.5, drop: 0.3, seed: 12 },
  ]) {
    const paths = hangingVines({ vines, length, drop, seed })
    expect(paths).toHaveLength(vines)
    for (const { points } of paths) {
      const fall = points[0].y + 0.03 - points[points.length - 1].y
      expect(fall).toBeGreaterThanOrEqual(0.45 * length - 1e-9)
      expect(fall).toBeLessThanOrEqual(0.95 * length + 1e-9)
      // From the soil, over the rim (at most 3 cm above it), then down past the bottom of the pot.
      for (const p of points) {
        expect(p.y).toBeLessThan(-drop + 0.03)
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(VINE_REACH + 1e-9)
      }
      expect(points[points.length - 1].y).toBeLessThan(-drop - HANGING_POT.h)
    }
  }
  const few = hangingGeometry({ seed: 5, glaze: 'white', vines: 4, length: 0.9, drop: 0.55 })
  const many = hangingGeometry({ seed: 5, glaze: 'white', vines: 11, length: 0.9, drop: 0.55 })
  expect(many.canopy.getAttribute('position').count).toBeGreaterThan(2 * few.canopy.getAttribute('position').count)
})
