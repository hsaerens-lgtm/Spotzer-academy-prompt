import { FLOOR_LAMP } from '../../three/props/FloorLamp'
import { layout, layoutVersion } from './layout'
import { TUNABLE, applyTransform, isTuneEnabled, layoutSnapshot, linkedLights } from './tune'

test('tuning is only available in development with ?tune', () => {
  expect(isTuneEnabled('?tune', true)).toBe(true)
  expect(isTuneEnabled('?tune', false)).toBe(false)
  expect(isTuneEnabled('', true)).toBe(false)
})

test('moving an object updates the layout and bumps its version', () => {
  const before = layoutVersion.current
  applyTransform('laptop', [1, 2, 3], 0.5)
  expect(layout.objects.laptop).toEqual({ position: [1, 2, 3], rotationY: 0.5 })
  applyTransform('ada', [-3, 1, -4], 0.2)
  expect(layout.ada).toEqual({ position: [-3, 1, -4], rotationY: 0.2 })
  applyTransform('table', [0, 0, 0], 1)
  expect(layout.objects.table).toEqual({ position: [0, 0, 0] })
  expect(layoutVersion.current).toBe(before + 3)
})

test('the snapshot is plain JSON with every tunable section', () => {
  const snapshot = layoutSnapshot()
  expect(Object.keys(snapshot)).toEqual(['rail', 'flights', 'objects', 'screen', 'ada', 'lights'])
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
})

// The floor lamp's light shines from the centre of its shade (floorLamp.test.ts): the panel moves both at once.
test('moving the floor lamp moves its light with it, still at the centre of the shade', () => {
  expect(TUNABLE).toContain('floorLamp')
  const [x, y, z] = layout.objects.floorLamp.position
  applyTransform('floorLamp', [x + 0.5, y, z - 0.25], 0)
  expect(layout.objects.floorLamp.position).toEqual([x + 0.5, y, z - 0.25])
  const light = layout.lights.floorLamp.position
  expect(light[0]).toBeCloseTo(x + 0.5)
  expect(light[1]).toBeCloseTo(y + FLOOR_LAMP.top - FLOOR_LAMP.shadeHeight / 2)
  expect(light[2]).toBeCloseTo(z - 0.25)
  // TuneMode moves the scene light named here to that position.
  expect(linkedLights('floorLamp')).toEqual([{ name: 'floor-lamp-light', position: light }])
  expect(linkedLights('laptop')).toEqual([])
})
