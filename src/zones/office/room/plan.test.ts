import { Texture } from 'three'
import { TEXTURE_SET_IDS } from '../../../three/assets'
import { buildMaterials } from '../../../three/materials'
import type { TextureSets } from '../../../three/textures'
import { CONTACT_SHADOW_Y, GLAZING, ROOM, RUG, SLAT_WALL, WALL_T, layout, type Vec3 } from '../layout'
import {
  FLAT_LEVELS,
  banquetteBoxes,
  ceilingLineBoxes,
  glassPanes,
  glazingFrameBoxes,
  rugBox,
  shellBoxes,
  slatBoxes,
  type BoxSpec,
  type PaneSpec,
} from './plan'

const contains = (box: BoxSpec, p: Vec3) => [0, 1, 2].every((k) => Math.abs(p[k] - box.center[k]) <= box.size[k] / 2 + 1e-9)
/** Is p on the pane (within 5 cm of its plane)? Its width runs along x before it turns by rotationY. */
function onPane(pane: PaneSpec, p: Vec3): boolean {
  const dx = p[0] - pane.center[0]
  const dz = p[2] - pane.center[2]
  const along = dx * Math.cos(pane.rotationY) - dz * Math.sin(pane.rotationY)
  const across = dx * Math.sin(pane.rotationY) + dz * Math.cos(pane.rotationY)
  return Math.abs(along) <= pane.size[0] / 2 + 1e-9 && Math.abs(p[1] - pane.center[1]) <= pane.size[1] / 2 + 1e-9 && Math.abs(across) < 0.05
}
/** Midpoints of 10 cm steps between a and b. */
const steps = (a: number, b: number) => Array.from({ length: Math.round((b - a) * 10) }, (_, i) => a + (i + 0.5) / 10)
const top = (box: BoxSpec) => box.center[1] + box.size[1] / 2
const bottom = (box: BoxSpec) => box.center[1] - box.size[1] / 2

test('walls leave the glazing open and close everything else', () => {
  const walls = shellBoxes().filter((b) => b.name.startsWith('wall-'))
  const panes = glassPanes()
  const inWall = (p: Vec3) => walls.some((w) => contains(w, p))
  const onGlass = (p: Vec3) => panes.some((pane) => onPane(pane, p))
  for (const wall of walls) expect(Math.min(...wall.size), wall.name).toBeCloseTo(WALL_T)
  for (const y of [0.1, ROOM.height / 2, ROOM.height - 0.1]) {
    for (const z of steps(ROOM.z0, ROOM.z1)) {
      const glazed = z < GLAZING.side.z1
      expect(inWall([ROOM.x0 - WALL_T / 2, y, z]), `left wall at z ${z}`).toBe(!glazed)
      expect(onGlass([ROOM.x0 - GLAZING.glassInset, y, z]), `side glass at z ${z}`).toBe(glazed)
      expect(inWall([ROOM.x1 + WALL_T / 2, y, z]), `right wall at z ${z}`).toBe(true)
    }
    for (const x of steps(ROOM.x0, ROOM.x1)) {
      const glazed = x < GLAZING.back.x1
      expect(inWall([x, y, ROOM.z0 - WALL_T / 2]), `back wall at x ${x}`).toBe(!glazed)
      expect(onGlass([x, y, ROOM.z0 - GLAZING.glassInset]), `back glass at x ${x}`).toBe(glazed)
      expect(inWall([x, y, ROOM.z1 + WALL_T / 2]), `front wall at x ${x}`).toBe(true)
    }
  }
  const floor = shellBoxes().find((b) => b.name === 'floor')!
  const ceiling = shellBoxes().find((b) => b.name === 'ceiling')!
  expect(top(floor)).toBe(0)
  expect(bottom(ceiling)).toBeCloseTo(ROOM.height)
  for (const x of [ROOM.x0 - 0.1, 0, ROOM.x1 + 0.1]) {
    for (const z of [ROOM.z0 - 0.1, 0, ROOM.z1 + 0.1]) {
      expect(contains(floor, [x, -0.05, z])).toBe(true)
      expect(contains(ceiling, [x, ROOM.height + 0.05, z])).toBe(true)
    }
  }
})

test('mullions stand at most 1.25 m apart along the fa\u00e7ade and the return', () => {
  const posts = glazingFrameBoxes().filter((b) => b.name.startsWith('post-'))
  const along = (values: number[]) => [...values].sort((a, b) => a - b)
  const sideZ = along(posts.filter((p) => p.center[0] === GLAZING.side.x).map((p) => p.center[2]))
  const backX = along(posts.filter((p) => p.center[2] === GLAZING.back.z).map((p) => p.center[0]))
  for (const [run, values, start, end] of [
    ['facade', sideZ, GLAZING.side.z0, GLAZING.side.z1],
    ['return', backX, GLAZING.back.x0, GLAZING.back.x1],
  ] as const) {
    expect(values[0], run).toBe(start)
    expect(end - values[values.length - 1], run).toBeLessThan(0.05)
    for (let i = 1; i < values.length; i++) expect(values[i] - values[i - 1], `${run} gap ${i}`).toBeLessThanOrEqual(1.25 + 1e-9)
  }
  for (const post of posts) expect(post.size[1], post.name).toBe(ROOM.height)
  const transoms = glazingFrameBoxes().filter((b) => b.name.startsWith('transom-'))
  expect(transoms.map((t) => t.center[1])).toEqual([GLAZING.transomY, GLAZING.transomY])
})

test('slats cover the wall behind the screen and stop before the glass', () => {
  const slats = slatBoxes()
  expect(slats).toHaveLength(78)
  const left = Math.min(...slats.map((s) => s.center[0] - s.size[0] / 2))
  const right = Math.max(...slats.map((s) => s.center[0] + s.size[0] / 2))
  expect(left).toBeCloseTo(SLAT_WALL.x0)
  expect(right).toBeLessThanOrEqual(SLAT_WALL.x1 + 1e-9)
  // Wider than the wall screen and its 3 cm frame...
  const [sx] = layout.screen.position
  const half = (layout.screen.size[0] + 0.03) / 2
  expect(left).toBeLessThan(sx - half)
  expect(right).toBeGreaterThan(sx + half)
  // ...but clear of the end post of the glass return.
  const endPost = glazingFrameBoxes().find((b) => b.name === 'post-back-end')!
  expect(left).toBeGreaterThan(endPost.center[0] + endPost.size[0] / 2)
  for (const slat of slats) {
    expect(slat.center[2] - slat.size[2] / 2, slat.name).toBeCloseTo(ROOM.z0) // against the wall
    expect(slat.center[2] + slat.size[2] / 2, slat.name).toBeLessThan(layout.screen.position[2] - 0.03) // behind the screen frame
    expect(slat.size[1], slat.name).toBe(ROOM.height)
  }
})

test('nothing laid flat shares a height', () => {
  const levels = FLAT_LEVELS.map((level) => level.y).sort((a, b) => a - b)
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeGreaterThanOrEqual(0.005)
  const rug = rugBox()
  expect(bottom(rug)).toBeCloseTo(0)
  expect(top(rug)).toBeCloseTo(RUG.thickness)
  expect(FLAT_LEVELS.map((level) => level.y)).toEqual([0, RUG.thickness, CONTACT_SHADOW_Y])
  expect(top(shellBoxes().find((b) => b.name === 'floor')!)).toBe(0)
})

/** One face of a box: the axis it is perpendicular to, which way it points, and where its plane stands. */
interface Face {
  box: BoxSpec
  axis: 0 | 1 | 2
  sign: 1 | -1
  plane: number
}
const facesOf = (b: BoxSpec): Face[] =>
  ([0, 1, 2] as const).flatMap((axis) => ([1, -1] as const).map((sign) => ({ box: b, axis, sign, plane: b.center[axis] + (sign * b.size[axis]) / 2 })))
/** How far two boxes overlap along one axis (0 when they merely touch). */
function overlapLength(a: BoxSpec, b: BoxSpec, k: number): number {
  const length = Math.min(a.center[k] + a.size[k] / 2, b.center[k] + b.size[k] / 2) - Math.max(a.center[k] - a.size[k] / 2, b.center[k] - b.size[k] / 2)
  return length > 1e-6 ? length : 0
}
const BOUNDS = [
  [ROOM.x0, ROOM.x1],
  [0, ROOM.height],
  [ROOM.z0, ROOM.z1],
] as const
/**
 * The allow-list of faces that may share a plane, because nobody sees them: a face that lies on or beyond the room
 * boundary and points away from the room is pressed against a wall, the floor slab or the ceiling slab, or is outside.
 * That covers the outer faces at the wall corners, the wall tops under the ceiling slab, the wall bottoms on the floor
 * slab, and the backs, tops and bottoms of slats and skirting. The glazing frame gets no such pass: all its faces count.
 */
const hidden = (f: Face) => !/^(post|transom)-/.test(f.box.name) && f.sign * (f.plane - BOUNDS[f.axis][f.sign > 0 ? 1 : 0]) >= -1e-3
/** Pairs of faces with the same normal on the same plane (within 1 mm) that overlap by some area, unless both are hidden. */
function coplanarPairs(boxes: BoxSpec[]): string[] {
  const faces = boxes.flatMap(facesOf)
  const pairs: string[] = []
  for (const [i, a] of faces.entries()) {
    for (const b of faces.slice(i + 1)) {
      if (a.box === b.box || a.axis !== b.axis || a.sign !== b.sign || Math.abs(a.plane - b.plane) > 1e-3) continue
      if ([0, 1, 2].some((k) => k !== a.axis && overlapLength(a.box, b.box, k) === 0)) continue
      if (hidden(a) && hidden(b)) continue
      pairs.push(`${a.box.name} / ${b.box.name}: ${a.sign > 0 ? '+' : '-'}${'xyz'[a.axis]} face at ${a.plane.toFixed(3)}`)
    }
  }
  return pairs
}

test('no two surfaces of the room share a plane where they can be seen', () => {
  const all = [...shellBoxes(), ...glazingFrameBoxes(), ...slatBoxes(), ...banquetteBoxes(), ...ceilingLineBoxes(), rugBox()]
  expect(coplanarPairs(all)).toEqual([])
})

test('the coplanar check finds shared faces, ignores boxes that only touch and lets hidden faces be', () => {
  const crate = (name: string, center: Vec3, size: Vec3): BoxSpec => ({ name, center, size, material: 'oak', castShadow: true, receiveShadow: true })
  // Level tops and bottoms that overlap, in the middle of the room: both pairs are reported.
  const level = [crate('a', [0, 1, 0], [1, 1, 1]), crate('b', [0.5, 1, 0.5], [1, 1, 1])]
  expect(coplanarPairs(level)).toEqual(['a / b: +y face at 1.500', 'a / b: -y face at 0.500'])
  // Side by side: the tops are level but the boxes only touch.
  expect(coplanarPairs([crate('a', [0, 1, 0], [1, 1, 1]), crate('b', [1, 1, 0], [1, 1, 1])])).toEqual([])
  // Floor to ceiling: their ends are pressed against the slabs, nobody sees them.
  const tall = [crate('c', [0, ROOM.height / 2, 0], [1, ROOM.height, 1]), crate('d', [0.5, ROOM.height / 2, 0.5], [1, ROOM.height, 1])]
  expect(coplanarPairs(tall)).toEqual([])
})

test('the ceiling lines sit just under the ceiling, inside the room', () => {
  const lines = ceilingLineBoxes()
  expect(lines).toHaveLength(4)
  for (const line of lines) {
    expect(top(line), line.name).toBeLessThanOrEqual(ROOM.height + 1e-9)
    expect(top(line), line.name).toBeGreaterThan(ROOM.height - 0.02)
    expect(line.castShadow, line.name).toBe(false)
    for (const k of [0, 2] as const) {
      const lo = k === 0 ? ROOM.x0 : ROOM.z0
      const hi = k === 0 ? ROOM.x1 : ROOM.z1
      expect(line.center[k] - line.size[k] / 2, line.name).toBeGreaterThan(lo)
      expect(line.center[k] + line.size[k] / 2, line.name).toBeLessThan(hi)
    }
  }
  for (const i of [0, 1]) {
    const channel = lines.find((b) => b.name === `ceiling-channel-${i}`)!
    const strip = lines.find((b) => b.name === `ceiling-strip-${i}`)!
    expect(bottom(strip)).toBeLessThan(bottom(channel)) // the glowing strip shows below its channel
    expect(strip.size[0]).toBeLessThan(channel.size[0])
    expect(strip.material).toBe('ceilingStrip')
  }
})

test('every box uses a shared material key', () => {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
  const keys = Object.keys(buildMaterials(sets))
  const all = [...shellBoxes(), ...glazingFrameBoxes(), ...slatBoxes(), ...banquetteBoxes(), ...ceilingLineBoxes(), rugBox()]
  for (const box of all) expect(keys, box.name).toContain(box.material)
  expect(new Set(all.map((b) => b.name)).size).toBe(all.length)
  expect(shellBoxes().filter((b) => b.name.startsWith('wall-')).every((b) => b.material === 'wall' && b.castShadow && b.receiveShadow)).toBe(true)
})
