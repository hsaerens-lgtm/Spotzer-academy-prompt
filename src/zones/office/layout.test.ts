import { PARALLAX, makeRail } from './camera/railMath'
import { SIZES, sceneBoxes, segmentHitsBox, type Box } from './footprints'
import { SCREEN_BANDS, glazingFraction, projectBox, projectPoint } from './framing'
import { GLAZING, ROOM, SLAT_WALL, TABLE, chairRing, layout, tableHalfWidthAt, type Pose, type Vec3 } from './layout'
import { SCREEN_PX, screenDistanceFactor } from './WallScreen3D'

/*
 * Framing thresholds: the measurement minus a small margin (plan, Task 5). 1600 x 900 (16:9) is the reference
 * screen; 1280 x 600 is the smallest supported viewport (spec 1, section 8.6).
 */
const WIDE = 16 / 9
const SMALL = 1280 / 600
const { hudBottom, panelTop } = SCREEN_BANDS
/** The four extremes of the pointer parallax (CameraRig): look target + (+/-PARALLAX.x, -/+PARALLAX.y, 0). */
const EXTREMES: [number, number][] = [
  [PARALLAX.x, PARALLAX.y],
  [PARALLAX.x, -PARALLAX.y],
  [-PARALLAX.x, PARALLAX.y],
  [-PARALLAX.x, -PARALLAX.y],
]

const boxes = sceneBoxes()
function named(name: string): Box {
  const box = boxes.find((b) => b.name === name)
  if (!box) throw new Error(`no box named ${name}`)
  return box
}
const centre = (box: Box): Vec3 => [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2) as Vec3
const corners = (box: Box): Vec3[] =>
  [box.min[0], box.max[0]].flatMap((x) => [box.min[1], box.max[1]].flatMap((y) => [box.min[2], box.max[2]].map((z): Vec3 => [x, y, z])))
const union = (name: string, a: Box, b: Box): Box => ({
  name,
  min: [0, 1, 2].map((k) => Math.min(a.min[k], b.min[k])) as Vec3,
  max: [0, 1, 2].map((k) => Math.max(a.max[k], b.max[k])) as Vec3,
})
/** Names of the boxes, other than `allowed`, that the segment a -> b touches. */
const blockers = (a: Vec3, b: Vec3, allowed: string[]) =>
  boxes.filter((box) => !allowed.includes(box.name) && segmentHitsBox(a, b, box)).map((box) => box.name)
const overview = (): Pose => layout.rail[0]
/** The retro corner: the TV and the console together. */
const retroCorner = () => union('retroCorner', named('tv'), named('retroConsole'))

function expectInFrame(p: { u: number; v: number; inFront: boolean }, u: [number, number], v: [number, number], label: string) {
  expect(p.inFront, label).toBe(true)
  expect(p.u, label).toBeGreaterThanOrEqual(u[0])
  expect(p.u, label).toBeLessThanOrEqual(u[1])
  expect(p.v, label).toBeGreaterThanOrEqual(v[0])
  expect(p.v, label).toBeLessThanOrEqual(v[1])
}

/** Distance from a floor point to the racetrack outline (a 2D capsule around the table's long axis). */
function distanceToTableEdge(x: number, z: number): number {
  const { center, radii } = TABLE
  const straight = radii.z - radii.x
  const nearestZ = Math.min(center.z + straight, Math.max(center.z - straight, z))
  return Math.hypot(x - center.x, z - nearestZ) - radii.x
}

test('eight chairs sit outside the racetrack table, 45 cm clear, and face it', () => {
  const chairs = chairRing()
  expect(chairs).toHaveLength(8)
  for (const chair of chairs) {
    const [x, , z] = chair.position
    expect(distanceToTableEdge(x, z), `chair at ${x}, ${z}`).toBeGreaterThanOrEqual(0.45)
    expect(chair.rotationY).toBe(x < TABLE.center.x ? Math.PI / 2 : -Math.PI / 2)
  }
  expect(chairs.map((c) => +c.position[0].toFixed(4))).toEqual([-2.6225, 0.6225, -2.75, 0.75, -2.75, 0.75, -2.6225, 0.6225])
})

test('the table keeps its 2.5 \u00d7 5 m footprint', () => {
  const { center, radii } = TABLE
  expect(tableHalfWidthAt(center.z)).toBe(1.25)
  expect(tableHalfWidthAt(center.z - 1.25)).toBe(1.25)
  expect(tableHalfWidthAt(center.z + 1.875)).toBeCloseTo(Math.sqrt(1.25 ** 2 - 0.625 ** 2))
  expect(tableHalfWidthAt(center.z + radii.z)).toBe(0)
  expect(tableHalfWidthAt(center.z - radii.z - 0.1)).toBe(0)
  expect(SIZES.table).toEqual([2 * radii.x, TABLE.topY, 2 * radii.z])
  expect(layout.objects.table.position).toEqual([center.x, 0, center.z])
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

test('the lamp stands on the sideboard, clear of the screen', () => {
  const [radius, height] = [SIZES.lamp[0] / 2, SIZES.lamp[1]] // 0.14 and 0.48 m
  const [lx, ly, lz] = layout.objects.lamp.position
  const [bx, by, bz] = layout.objects.sideboard.position
  expect(ly).toBeCloseTo(by + SIZES.sideboard[1])
  expect(lx - radius).toBeGreaterThanOrEqual(bx - SIZES.sideboard[0] / 2)
  expect(lx + radius).toBeLessThanOrEqual(bx + SIZES.sideboard[0] / 2)
  expect(lz).toBeCloseTo(bz)
  // The wall screen and its 3 cm frame (WallScreen3D).
  const [sx, sy] = layout.screen.position
  const [w, h] = [layout.screen.size[0] + 0.03, layout.screen.size[1] + 0.03]
  const outsideX = lx + radius < sx - w / 2 || lx - radius > sx + w / 2
  const outsideY = ly + height < sy - h / 2 || ly > sy + h / 2
  expect(outsideX || outsideY).toBe(true)
})

test('the clock hangs on the back wall, clear of the screen frame and the logo', () => {
  const clock = named('clock')
  const logo = named('logo')
  expect(clock.min[2]).toBeCloseTo(ROOM.z0) // against the plaster
  expect(clock.min[0]).toBeGreaterThan(SLAT_WALL.x1) // beyond the oak slats
  const frameRight = layout.screen.position[0] + (layout.screen.size[0] + 0.03) / 2
  expect(clock.min[0]).toBeGreaterThan(frameRight)
  expect(clock.max[0]).toBeLessThan(logo.min[0])
  expect(clock.max[1]).toBeLessThan(ROOM.height)
})

test('every object stays inside the room', () => {
  const lo = [ROOM.x0, 0, ROOM.z0]
  const hi = [ROOM.x1, ROOM.height, ROOM.z1]
  const inside = (min: number[], max: number[], label: string) => {
    for (let k = 0; k < 3; k++) {
      expect(min[k], `${label} min ${k}`).toBeGreaterThanOrEqual(lo[k] - 1e-9)
      expect(max[k], `${label} max ${k}`).toBeLessThanOrEqual(hi[k] + 1e-9)
    }
  }
  for (const box of boxes) if (!box.name.startsWith('plant-')) inside(box.min, box.max, box.name)
  // Plants are held by their pot: the canopy bounds of the banquette plants (SIZES x scale) lean on the glass,
  // and the pothos trails are a generous bound below the bench top.
  layout.objects.plants.forEach(({ position: [x, y, z], r, h }, i) => inside([x - r, y, z - r], [x + r, y + h, z + r], `plant-${i} pot`))
})

// Spec criterion 3 (amended): the most glazing compatible with the retro corner; measured 13.9 % (16:9) and 16.3 % (1280 x 600),
// 12.3 % and 14.7 % at the worst parallax extreme.
test('the overview shows as much glazing as the retro corner allows', () => {
  expect(glazingFraction(overview(), WIDE).total).toBeGreaterThanOrEqual(0.135)
  expect(glazingFraction(overview(), SMALL).total).toBeGreaterThanOrEqual(0.155)
  for (const parallax of EXTREMES) {
    expect(glazingFraction(overview(), WIDE, { parallax }).total, `16:9 ${parallax}`).toBeGreaterThanOrEqual(0.12)
    expect(glazingFraction(overview(), SMALL, { parallax }).total, `1280 x 600 ${parallax}`).toBeGreaterThanOrEqual(0.14)
  }
  // The exact share (clipped projection of the glass rectangles) agrees with a count of rays.
  const counted = glazingFraction(overview(), WIDE, { samples: 400 })
  expect(Math.abs(counted.total - glazingFraction(overview(), WIDE).total)).toBeLessThan(0.004)
})

// Review focus 5: the whole TV and console, clear of the HUD and the welcome panel, seen from every pointer position.
test('the overview keeps the retro corner in frame', () => {
  const corner = retroCorner()
  const atRest = projectBox(overview(), WIDE, corner)
  expect(atRest.u0).toBeGreaterThanOrEqual(0.02)
  expect(atRest.u1).toBeLessThanOrEqual(0.99)
  expect(atRest.v0).toBeGreaterThanOrEqual(hudBottom)
  expect(atRest.v1).toBeLessThanOrEqual(panelTop)
  expect((atRest.v1 - atRest.v0) * 900).toBeGreaterThanOrEqual(100)
  const small = projectBox(overview(), SMALL, corner)
  expect((small.v1 - small.v0) * 600).toBeGreaterThanOrEqual(60)
  for (const parallax of EXTREMES) {
    expectInFrame(projectPoint(overview(), WIDE, centre(corner), parallax), [0.01, 0.98], [hudBottom, panelTop], `parallax ${parallax}`)
  }
  for (const point of [centre(corner), ...corners(corner)]) {
    expect(blockers(overview().position, point, ['tv', 'retroConsole', 'tvStand']), `sightline to ${point}`).toEqual([])
  }
})

test('the TV picture faces the overview camera', () => {
  const { position, rotationY = 0 } = layout.objects.tv
  const normal: Vec3 = [Math.sin(rotationY), 0, Math.cos(rotationY)]
  // Front face of the normalised television_02 model (0.35 m deep), at the height of its picture.
  const picture: Vec3 = [position[0] + normal[0] * 0.175, position[1] + 0.235, position[2] + normal[2] * 0.175]
  const toCamera = overview().position.map((c, k) => c - picture[k])
  const cos = toCamera.reduce((sum, d, k) => sum + d * normal[k], 0) / Math.hypot(...toCamera)
  expect((Math.acos(cos) * 180) / Math.PI).toBeLessThanOrEqual(73)
})

test('the wall screen and Ada stay in the overview', () => {
  expectInFrame(projectPoint(overview(), WIDE, layout.screen.position), [0.05, 0.95], [hudBottom, panelTop], 'wall screen')
  expectInFrame(projectPoint(overview(), WIDE, centre(named('ada'))), [0.05, 0.95], [hudBottom, panelTop], 'Ada')
})

// Spec section 3, "Contrainte": nothing hides the laptop in the overview.
test('nothing stands between the overview camera and the laptop', () => {
  expect(blockers(overview().position, centre(named('laptop')), ['laptop', 'table'])).toEqual([])
})

// Review focus 5: the e2e hover aims at this point (about 537 x 509 px at 1600 x 900).
test('the laptop stays clear of the HUD and the welcome panel', () => {
  const laptop = centre(named('laptop'))
  expectInFrame(projectPoint(overview(), WIDE, laptop), [0.2, 0.8], [hudBottom, 0.7], 'at rest')
  for (const parallax of EXTREMES) {
    expectInFrame(projectPoint(overview(), WIDE, laptop, parallax), [0.05, 0.95], [hudBottom, panelTop], `parallax ${parallax}`)
  }
})

test('the city opens up along the rail', () => {
  const middle = makeRail(layout.rail)(0.5)
  const pose: Pose = { position: middle.position.toArray() as Vec3, target: middle.target.toArray() as Vec3 }
  expect(glazingFraction(pose, WIDE).total).toBeGreaterThan(glazingFraction(overview(), WIDE).total + 0.05)
})

test('the city shows behind Ada in the presentation view', () => {
  const presentation = layout.rail[2]
  expect(glazingFraction(presentation, WIDE).back).toBeGreaterThanOrEqual(0.17)
  // The line of sight to Ada's head (0.84 m above her base), carried on to the back wall, lands in the glass return.
  const head: Vec3 = [layout.ada.position[0], layout.ada.position[1] + 0.84, layout.ada.position[2]]
  const [cx, cy, cz] = presentation.position
  const t = (GLAZING.back.z - cz) / (head[2] - cz)
  const x = cx + (head[0] - cx) * t
  const y = cy + (head[1] - cy) * t
  expect(x).toBeGreaterThanOrEqual(GLAZING.back.x0)
  expect(x).toBeLessThanOrEqual(GLAZING.back.x1)
  expect(y).toBeGreaterThanOrEqual(0)
  expect(y).toBeLessThanOrEqual(ROOM.height)
})

test('nothing hides the wall screen in the presentation view', () => {
  // The useful area of the screen, inset from its edges (the microphone heads already bite its bottom 6 cm in spec 1).
  const from = layout.rail[2].position
  const z = layout.screen.position[2]
  for (const x of [-2.8, -1.9, -1.0, -0.1, 0.8]) {
    for (const y of [0.95, 1.9, 2.85]) expect(blockers(from, [x, y, z], []), `screen point ${x}, ${y}`).toEqual([])
  }
})
