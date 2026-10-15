import type { MapDef } from './model'
import { DELTA, type Cell, type Dir, type Pose } from './movement'

export interface ParsedMap {
  width: number
  height: number
  /** Walkable cells, indexed y * width + x (guardian, boss and start cells included). */
  floor: boolean[]
  start: Pose
  boss: Cell
  /** In path order: the order the player meets them. */
  guardians: Cell[]
  torches: Cell[]
  inscriptions: Cell[]
}

const FLOOR_CHARS = new Set(['.', 'S', 'G', 'B'])
const WALL_CHARS = new Set(['#', 't', 'i'])
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y
const neighbours = (c: Cell): Cell[] => Object.values(DELTA).map((d) => ({ x: c.x + d.x, y: c.y + d.y }))

export function isFloor(map: ParsedMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height && map.floor[y * map.width + x]
}

/** Cells reachable from `from` through floor cells `isOpen` accepts: y * width + x → distance. */
function reachable(map: ParsedMap, from: Cell, isOpen: (c: Cell) => boolean): Map<number, number> {
  const seen = new Map<number, number>([[from.y * map.width + from.x, 0]])
  const queue: Cell[] = [from]
  while (queue.length > 0) {
    const cell = queue.shift()!
    const distance = seen.get(cell.y * map.width + cell.x)!
    for (const next of neighbours(cell)) {
      const key = next.y * map.width + next.x
      if (seen.has(key) || !isFloor(map, next.x, next.y) || !isOpen(next)) continue
      seen.set(key, distance + 1)
      queue.push(next)
    }
  }
  return seen
}

export function parseMap(def: MapDef): ParsedMap {
  const width = def.rows[0].length
  const height = def.rows.length
  const floor: boolean[] = []
  let start: Cell | null = null
  let boss: Cell | null = null
  const guardians: Cell[] = []
  const torches: Cell[] = []
  const inscriptions: Cell[] = []
  def.rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Map row ${y} has width ${row.length}, not ${width}`)
    ;[...row].forEach((char, x) => {
      if (!FLOOR_CHARS.has(char) && !WALL_CHARS.has(char)) throw new Error(`Unknown map character "${char}" at ${x},${y}`)
      floor.push(FLOOR_CHARS.has(char))
      if (char === 'S') start = { x, y }
      if (char === 'B') boss = { x, y }
      if (char === 'G') guardians.push({ x, y })
      if (char === 't') torches.push({ x, y })
      if (char === 'i') inscriptions.push({ x, y })
    })
  })
  if (!start) throw new Error('The map has no start (S)')
  if (!boss) throw new Error('The map has no boss (B)')
  const map: ParsedMap = { width, height, floor, start: { ...(start as Cell), dir: def.dir as Dir }, boss, guardians, torches, inscriptions }
  const distance = reachable(map, map.start, () => true)
  const far = Number.MAX_SAFE_INTEGER
  map.guardians.sort((a, b) => (distance.get(a.y * width + a.x) ?? far) - (distance.get(b.y * width + b.x) ?? far))
  return map
}

/** Spec 3, §4.3: closed, every floor cell reachable, guardians unavoidable and met in order. */
export function mapIssues(map: ParsedMap, guardianCount: number): string[] {
  const issues: string[] = []
  for (let x = 0; x < map.width; x++) {
    for (const y of [0, map.height - 1]) if (isFloor(map, x, y)) issues.push(`floor on the border at ${x},${y}`)
  }
  for (let y = 0; y < map.height; y++) {
    for (const x of [0, map.width - 1]) if (isFloor(map, x, y)) issues.push(`floor on the border at ${x},${y}`)
  }
  if (map.guardians.length !== guardianCount) issues.push(`the map has ${map.guardians.length} guardians, not ${guardianCount}`)
  const all = reachable(map, map.start, () => true)
  map.floor.forEach((walkable, key) => {
    if (walkable && !all.has(key)) issues.push(`unreachable floor at ${key % map.width},${Math.floor(key / map.width)}`)
  })
  const touches = (region: Map<number, number>, target: Cell) => neighbours(target).some((n) => region.has(n.y * map.width + n.x))
  for (let k = 0; k <= map.guardians.length; k++) {
    const closed = (c: Cell) => sameCell(c, map.boss) || map.guardians.slice(k).some((g) => sameCell(g, c))
    const region = reachable(map, map.start, (c) => !closed(c))
    if (k < map.guardians.length) {
      if (!touches(region, map.guardians[k])) issues.push(`guardian ${k + 1} cannot be reached in order`)
      if (touches(region, map.boss)) issues.push(`the boss can be reached before guardian ${k + 1}`)
      for (let j = k + 1; j < map.guardians.length; j++) {
        if (touches(region, map.guardians[j])) issues.push(`guardian ${j + 1} can be reached before guardian ${k + 1}`)
      }
    } else if (!touches(region, map.boss)) issues.push('the boss cannot be reached')
  }
  return issues
}

/** A pose on a reachable neighbour of `target`, facing it (text mode jumps there). */
export function approach(map: ParsedMap, isOpen: (x: number, y: number) => boolean, target: Cell): Pose | null {
  const region = reachable(map, map.start, (c) => isOpen(c.x, c.y))
  for (const [dir, d] of Object.entries(DELTA) as [Dir, Cell][]) {
    const from = { x: target.x - d.x, y: target.y - d.y }
    if (region.has(from.y * map.width + from.x)) return { ...from, dir }
  }
  return null
}
