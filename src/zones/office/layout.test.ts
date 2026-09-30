import { SCREEN_PX, screenDistanceFactor } from './WallScreen3D'
import { TABLE, chairRing, layout } from './layout'

test('eight chairs sit outside the table and face it', () => {
  const chairs = chairRing()
  expect(chairs).toHaveLength(8)
  for (const chair of chairs) {
    const [x, , z] = chair.position
    const inside = ((x - TABLE.center.x) / TABLE.radii.x) ** 2 + ((z - TABLE.center.z) / TABLE.radii.z) ** 2
    expect(inside).toBeGreaterThan(1)
    expect(chair.rotationY).toBe(x < TABLE.center.x ? Math.PI / 2 : -Math.PI / 2)
  }
})

test('the wall screen keeps the 16:9 ratio of its content', () => {
  const [width, height] = layout.screen.size
  expect(width / height).toBeCloseTo(SCREEN_PX.width / SCREEN_PX.height)
})

test('1280 CSS pixels span the screen width', () => {
  // drei <Html transform> maps 1 CSS pixel to distanceFactor / 400 world units.
  const factor = screenDistanceFactor(layout.screen.size[0])
  expect((SCREEN_PX.width * factor) / 400).toBeCloseTo(layout.screen.size[0])
})

test('the presentation view looks at the screen wall', () => {
  expect(layout.rail[2].target[2]).toBeCloseTo(layout.screen.position[2] - 0.04, 1)
})
