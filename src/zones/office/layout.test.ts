import { CRT_SCREEN } from '../../three/assets'
import { PARALLAX, makeRail } from './camera/railMath'
import { SIZES, sceneBoxes, segmentHitsBox, type Box } from './footprints'
import { SCREEN_BANDS, glazingFraction, projectBox, projectPoint } from './framing'
import { CAMERA, GLAZING, ROOM, SLAT_WALL, TABLE, chairRing, layout, tableHalfWidthAt, type Pose, type Vec3 } from './layout'
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
/**
 * How far the right edge of the TV box or the console box may pass the right edge of the frame at a pointer extreme:
 * 1 % of the width (16 px at 1600). Measured: with the pointer far left, the console box ends at u 1.004 in 16:9
 * (about 7 px out) and the TV box at u 0.997; the TV picture itself stays in frame (u <= 0.98, tested separately).
 */
const EXTREME_RIGHT_EDGE = 1.01

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
/** Whether two boxes share some volume (faces that only touch do not count). */
const overlap = (a: Box, b: Box) => [0, 1, 2].every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 1e-9)
/** Names of the other boxes that share some volume with `box`. */
const clashes = (box: Box) => boxes.filter((other) => other !== box && overlap(other, box)).map((other) => other.name)
const grown = (box: Box, by: number): Box => ({ name: box.name, min: box.min.map((v) => v - by) as Vec3, max: box.max.map((v) => v + by) as Vec3 })
const overview = (): Pose => layout.rail[0]
/** The retro corner: the TV and the console together. */
const retroCorner = () => union('retroCorner', named('tv'), named('retroConsole'))
/** World corners of the TV picture (CRT_SCREEN, in the frame of the normalised television_02 model, front +z). */
function pictureCorners(): Vec3[] {
  const { position, rotationY = 0 } = layout.objects.tv
  const [cos, sin] = [Math.cos(rotationY), Math.sin(rotationY)]
  const [cx, cy, cz] = CRT_SCREEN.center
  return [-1, 1].flatMap((i) =>
    [-1, 1].map((j): Vec3 => {
      const x = cx + (i * CRT_SCREEN.width) / 2
      return [position[0] + x * cos + cz * sin, position[1] + cy + (j * CRT_SCREEN.height) / 2, position[2] - x * sin + cz * cos]
    }),
  )
}

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

// Task 10 review: the sign is built from its position forward (LogoCubes), so its position is the back of its plate.
test('the sign hangs on the back wall, its plate a few millimetres off the plaster', () => {
  const logo = named('logo')
  expect(logo.min[2]).toBeCloseTo(layout.objects.logo.position[2])
  expect(logo.min[2] - ROOM.z0).toBeGreaterThan(0.001) // no z-fighting with the wall
  expect(logo.min[2] - ROOM.z0).toBeLessThanOrEqual(0.01) // not floating in front of it
  expect(clashes(logo)).toEqual([])
  // Clear of the wall screen and its frame, where drei's occlusion leaves the DOM page showing through the canvas.
  const frameRight = layout.screen.position[0] + (layout.screen.size[0] + 0.03) / 2
  expect(logo.min[0]).toBeGreaterThan(frameRight)
})

// Task 10b: the floor lamp of the lounge corner.
test('the floor lamp stands on the floor beside the sofa, clear of every other object', () => {
  const lamp = named('floorLamp')
  const sofa = named('sofa')
  expect(lamp.min[1]).toBeCloseTo(0)
  expect(clashes(lamp)).toEqual([])
  // Beside the sofa: at most 40 cm from it across the floor.
  const gap = Math.max(...[0, 2].map((k) => Math.max(sofa.min[k] - lamp.max[k], lamp.min[k] - sofa.max[k])))
  expect(gap).toBeGreaterThan(0)
  expect(gap).toBeLessThanOrEqual(0.4)
})

test('the floor lamp hides neither the TV, the console nor the laptop from the overview, and shows in it', () => {
  const lamp = named('floorLamp')
  for (const name of ['tv', 'retroConsole', 'laptop']) {
    expect(segmentHitsBox(overview().position, centre(named(name)), lamp), name).toBe(false)
  }
  expectInFrame(projectPoint(overview(), WIDE, layout.lights.floorLamp.position), [0.05, 0.95], [hudBottom, panelTop], 'floor lamp shade')
})

test('the flight to the TV never passes through the floor lamp', () => {
  // The camera flies straight from wherever it is on the rail (CameraRig, lerpPose); its near plane stays out of the lamp too.
  const lamp = grown(named('floorLamp'), CAMERA.near)
  const sample = makeRail(layout.rail)
  const { position, target } = layout.flights.tv
  for (let i = 0; i <= 20; i++) {
    const from = sample(i / 20).position.toArray() as Vec3
    expect(segmentHitsBox(from, position, lamp), `from the rail at ${i / 20}`).toBe(false)
  }
  expect(segmentHitsBox(position, target, lamp)).toBe(false)
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
  expect(Math.abs(counted.total - glazingFraction(overview(), WIDE).total)).toBeLessThan(0.001)
})

/*
 * Review focus 5. At rest in 16:9, the TV and the console together lie whole in the frame, between the HUD and the
 * welcome panel, at least 100 px tall (60 px at 1280 x 600). At each of the four pointer extremes, in 16:9 and
 * 1280 x 600: the TV box and the console box each stay between the HUD and the panel and right of u 0.02, their right
 * edges at most EXTREME_RIGHT_EDGE (a few pixels of the console box may leave the frame); the four corners of the
 * TV picture stay in frame (u 0.02 to 0.98, between the HUD and the panel); the centre of the corner stays at
 * u 0.01 to 0.98 in 16:9. No other object crosses the sightlines to the centre and the 8 corners of the corner.
 */
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
    for (const [aspect, frame] of [
      [WIDE, '16:9'],
      [SMALL, '1280 x 600'],
    ] as const) {
      for (const name of ['tv', 'retroConsole']) {
        const extent = projectBox(overview(), aspect, named(name), parallax)
        const label = `${name}, ${frame}, parallax ${parallax}`
        expect(extent.u0, label).toBeGreaterThanOrEqual(0.02)
        expect(extent.u1, label).toBeLessThanOrEqual(EXTREME_RIGHT_EDGE)
        expect(extent.v0, label).toBeGreaterThanOrEqual(hudBottom)
        expect(extent.v1, label).toBeLessThanOrEqual(panelTop)
      }
      for (const point of pictureCorners()) {
        expectInFrame(projectPoint(overview(), aspect, point, parallax), [0.02, 0.98], [hudBottom, panelTop], `TV picture, ${frame}, parallax ${parallax}`)
      }
    }
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

// Spec section 3, "Contrainte": nothing hides the laptop in the overview. Sightlines to the centre and the 8 corners of
// its box; only the laptop and the table under it may touch them.
test('nothing stands between the overview camera and the laptop', () => {
  const laptop = named('laptop')
  for (const point of [centre(laptop), ...corners(laptop)]) {
    expect(blockers(overview().position, point, ['laptop', 'table']), `sightline to ${point}`).toEqual([])
  }
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
  // Measured 25.7 % at mid-rail, the spec's "about 26 %".
  expect(glazingFraction(pose, WIDE).total).toBeGreaterThanOrEqual(0.25)
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

// Task 11: the flight into the TV ends in front of the television_02 picture, looking at its centre.
test('the TV flight ends 30 to 50 cm in front of the TV picture, aimed at its centre', () => {
  const { position, rotationY = 0 } = layout.objects.tv
  const [cx, cy, cz] = CRT_SCREEN.center
  const cos = Math.cos(rotationY)
  const sin = Math.sin(rotationY)
  // The picture centre and its normal (+z of the TV), turned by rotationY about y.
  const picture = [position[0] + cx * cos + cz * sin, position[1] + cy, position[2] - cx * sin + cz * cos]
  const normal = [sin, 0, cos]
  const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const { position: eye, target } = layout.flights.tv
  const distance = dot(sub(eye, picture), normal)
  expect(distance).toBeGreaterThanOrEqual(0.3)
  expect(distance).toBeLessThanOrEqual(0.5)
  // The line of sight crosses the picture plane within 2 cm of its centre.
  const aim = sub(target, eye)
  const k = dot(sub(picture, eye), normal) / dot(aim, normal)
  const hit = eye.map((value, i) => value + aim[i] * k)
  expect(Math.hypot(...sub(hit, picture))).toBeLessThan(0.02)
})
