import { SIZES, boxFor, sceneBoxes, segmentHitsBox, type Box } from './footprints'
import { ROOM, layout } from './layout'

const named = (name: string) => {
  const box = sceneBoxes().find((b) => b.name === name)
  if (!box) throw new Error(`no box named ${name}`)
  return box
}

test('boxes swap width and depth when turned a quarter', () => {
  expect(boxFor('a', { position: [1, 0, 2] }, [2, 1, 4])).toEqual({ name: 'a', min: [0, 0, 0], max: [2, 1, 4] })
  expect(boxFor('b', { position: [1, 0, 2], rotationY: -Math.PI / 2 }, [2, 1, 4])).toEqual({ name: 'b', min: [-1, 0, 1], max: [3, 1, 3] })
  // Turned less than 30 degrees: still counted as facing +z.
  expect(boxFor('c', { position: [0, 0, 0], rotationY: 0.5 }, [2, 1, 4]).max).toEqual([1, 1, 2])
  // In the room: the TV stand faces -x, so its 1.7 m length runs along z.
  const stand = named('tvStand')
  expect(stand.max[0] - stand.min[0]).toBeCloseTo(SIZES.tvStand[2])
  expect(stand.max[2] - stand.min[2]).toBeCloseTo(SIZES.tvStand[0])
})

test('hanging boxes extend below their hook', () => {
  expect(boxFor('h', { position: [0, 3, 0] }, [0.5, 0, 0.5], { below: 1.5 })).toEqual({ name: 'h', min: [-0.25, 1.5, -0.25], max: [0.25, 3, 0.25] })
  for (const name of ['hangingPlant-0', 'hangingPlant-1']) {
    const box = named(name)
    expect(box.max[1], name).toBe(ROOM.height)
    expect(box.min[1], name).toBeCloseTo(ROOM.height - SIZES.hangingPlant[1])
  }
  // The pothos on the banquette trails its vines below the bench top.
  expect(named('plant-4').min[1]).toBeLessThan(layout.objects.plants[4].position[1])
  // The sign is centred on its position.
  const logo = named('logo')
  expect((logo.min[1] + logo.max[1]) / 2).toBeCloseTo(layout.objects.logo.position[1])
})

test('segmentHitsBox finds crossings and misses', () => {
  const unit: Box = { name: 'unit', min: [0, 0, 0], max: [1, 1, 1] }
  expect(segmentHitsBox([-1, 0.5, 0.5], [2, 0.5, 0.5], unit)).toBe(true) // straight through
  expect(segmentHitsBox([-1, -1, 0.5], [2, 2, 0.5], unit)).toBe(true) // diagonal
  expect(segmentHitsBox([0.5, 0.5, 0.5], [3, 3, 3], unit)).toBe(true) // starts inside
  expect(segmentHitsBox([1, 0.5, -1], [1, 0.5, 2], unit)).toBe(true) // slides along a face: endpoints and faces count
  expect(segmentHitsBox([-1, 2, 0.5], [2, 2, 0.5], unit)).toBe(false) // passes above
  expect(segmentHitsBox([-1, 0.5, 0.5], [-0.1, 0.5, 0.5], unit)).toBe(false) // stops short
  expect(segmentHitsBox([0.5, 0.5, 2], [0.5, 0.5, 2], unit)).toBe(false) // a single point outside
})
