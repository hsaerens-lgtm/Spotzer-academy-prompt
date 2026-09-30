import { layout, layoutVersion } from './layout'
import { applyTransform, isTuneEnabled, layoutSnapshot } from './tune'

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
