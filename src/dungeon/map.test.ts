import { approach, mapIssues, parseMap, sameCell } from './map'

const def = {
  dir: 'E' as const,
  rows: [
    '#########',
    '#S..G.G.#',
    '#.##t##.#',
    '#.#i##B.#',
    '#########',
  ],
}

test('parses walls, start, boss, torches, inscriptions and guardians in path order', () => {
  const map = parseMap(def)
  expect(map.width).toBe(9)
  expect(map.start).toEqual({ x: 1, y: 1, dir: 'E' })
  expect(map.boss).toEqual({ x: 6, y: 3 })
  expect(map.guardians).toEqual([
    { x: 4, y: 1 },
    { x: 6, y: 1 },
  ])
  expect(map.torches).toEqual([{ x: 4, y: 2 }])
  expect(map.inscriptions).toEqual([{ x: 3, y: 3 }])
})

test('a well-formed map has no issues', () => {
  expect(mapIssues(parseMap(def), 2)).toEqual([])
})

test('reports a guardian that can be walked around, an open border and a wrong count', () => {
  const around = parseMap({ dir: 'E', rows: ['#######', '#S.G.B#', '#.....#', '#######'] })
  expect(mapIssues(around, 1).join(' ')).toMatch(/boss can be reached/)
  const leaky = parseMap({ dir: 'E', rows: ['#####', '#S.B.', '#####'] })
  expect(mapIssues(leaky, 0).join(' ')).toMatch(/border/)
  expect(mapIssues(parseMap(def), 3).join(' ')).toMatch(/2 guardians, not 3/)
})

test('rejects unknown characters, ragged rows and a missing start', () => {
  expect(() => parseMap({ dir: 'N', rows: ['###', '#x#', '###'] })).toThrow(/character/)
  expect(() => parseMap({ dir: 'N', rows: ['###', '#S', '###'] })).toThrow(/width/)
  expect(() => parseMap({ dir: 'N', rows: ['###', '#B#', '###'] })).toThrow(/start/)
})

test('approach faces the target from a reachable neighbour', () => {
  const map = parseMap(def)
  const isOpen = (x: number, y: number) => map.floor[y * map.width + x] && !sameCell({ x, y }, map.guardians[0]) && !sameCell({ x, y }, map.boss)
  expect(approach(map, isOpen, map.guardians[0])).toEqual({ x: 3, y: 1, dir: 'E' })
})
