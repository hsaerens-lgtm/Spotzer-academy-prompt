// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Box3, Color } from 'three'
import { SHELVES, layout } from '../zones/office/layout'
import { ATLAS, ATLAS_SEED, BOOK_SHELF_DEPTH, INK_CONTRAST, SPINE_CELLS, paintBookAtlas, shelfBooksGeometry, spineDesign } from './shelfBooks'
import { tints } from './tints'

const luminance = (colour: string) => {
  const c = new Color(colour)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

test('books fill the shelf span without overflowing', () => {
  expect(BOOK_SHELF_DEPTH).toBe(SHELVES.depth)
  // Room above each board: up to the next board, or 0.5 m on the top one.
  const boardTops = SHELVES.boards.map((y) => y + SHELVES.thickness)
  for (const spec of layout.objects.shelfBooks) {
    const box = new Box3().setFromBufferAttribute(shelfBooksGeometry(spec).getAttribute('position') as never)
    const label = JSON.stringify(spec)
    // 1 mm tolerance: a hardback's spine is 0.8 mm wider than its boards.
    expect(box.min.x, label).toBeGreaterThanOrEqual(spec.x0 - 0.001)
    expect(box.max.x, label).toBeLessThanOrEqual(spec.x1 + 0.001)
    expect(box.max.x - box.min.x, label).toBeGreaterThan(0.8 * (spec.x1 - spec.x0))
    expect(box.min.y, label).toBeGreaterThanOrEqual(spec.y - 0.001)
    const above = boardTops.find((top) => top > spec.y + 0.01)
    const ceiling = above === undefined ? spec.y + 0.5 : above - SHELVES.thickness
    expect(box.max.y, label).toBeLessThan(ceiling)
    expect(box.min.z, label).toBeGreaterThanOrEqual(spec.z - SHELVES.depth / 2)
    expect(box.max.z, label).toBeLessThanOrEqual(spec.z + SHELVES.depth / 2)
  }
})

test('every book maps into an atlas cell', () => {
  for (const spec of layout.objects.shelfBooks) {
    const uv = shelfBooksGeometry(spec).getAttribute('uv')
    // Non-indexed: each run of three vertices is one triangle, and a triangle never straddles two cells.
    for (let i = 0; i < uv.count; i += 3) {
      const us = [uv.getX(i), uv.getX(i + 1), uv.getX(i + 2)]
      const vs = [uv.getY(i), uv.getY(i + 1), uv.getY(i + 2)]
      for (const n of [...us, ...vs]) {
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(1)
      }
      const column = (u: number) => u * ATLAS.cols
      const row = (v: number) => v * ATLAS.rows
      expect(Math.floor(column(Math.min(...us)) + 1e-6)).toBe(Math.floor(column(Math.max(...us)) - 1e-6))
      expect(Math.floor(row(Math.min(...vs)) + 1e-6)).toBe(Math.floor(row(Math.max(...vs)) - 1e-6))
    }
  }
})

test('spine designs use the palette and carry no text', () => {
  const kinds = new Set<string>()
  for (let i = 0; i < SPINE_CELLS; i++) {
    const design = spineDesign(i, ATLAS_SEED)
    expect(spineDesign(i, ATLAS_SEED)).toEqual(design)
    expect(Object.keys(design).sort()).toEqual(['bands', 'cover', 'ink', 'kind'])
    expect(Number.isInteger(design.cover) && design.cover >= 0 && design.cover < tints.bookCovers.length).toBe(true)
    expect(Number.isInteger(design.ink) && design.ink >= 0 && design.ink < tints.bookInks.length).toBe(true)
    expect(Math.abs(luminance(tints.bookInks[design.ink]) - luminance(tints.bookCovers[design.cover]))).toBeGreaterThanOrEqual(INK_CONTRAST)
    for (const band of design.bands) {
      expect(band.y).toBeGreaterThanOrEqual(0)
      expect(band.h).toBeGreaterThan(0)
      expect(band.y + band.h).toBeLessThanOrEqual(1)
    }
    kinds.add(design.kind)
  }
  expect([...kinds].sort()).toEqual(['art', 'hardback', 'paperback'])
  // The atlas painter never draws letters (spec: no procedural texture carries text).
  const source = readFileSync(fileURLToPath(new URL('./shelfBooks.ts', import.meta.url)), 'utf8')
  expect(source).not.toMatch(/fillText|strokeText|measureText|\.font\s*=/)
})

/** The gradients of a recording context: inert, and one object, so two recordings compare equal. */
const GRADIENT = { addColorStop: () => {} }

/**
 * A 2D context that records what the painters do with it, for a test without a canvas (jsdom and Node have none):
 * every method called, with its arguments, and every property set.
 */
function recordingContext() {
  const calls: { name: string; args: unknown[] }[] = []
  const state: Record<string, unknown> = {}
  const context = new Proxy(state, {
    get: (target, name) => {
      if (typeof name !== 'string') return undefined
      if (name in target) return target[name]
      return (...args: unknown[]) => {
        calls.push({ name, args })
        return name.startsWith('create') ? GRADIENT : undefined
      }
    },
    set: (target, name, value) => {
      target[String(name)] = value
      calls.push({ name: `set ${String(name)}`, args: [value] })
      return true
    },
  })
  return { context: context as unknown as CanvasRenderingContext2D, calls }
}

test('the atlas painters fill every spine cell and never write text', () => {
  const { context, calls } = recordingContext()
  paintBookAtlas(context)
  const used = new Set(calls.map((call) => call.name))
  for (const text of ['fillText', 'strokeText', 'measureText', 'set font']) expect(used.has(text), text).toBe(false)
  // Each cell is first filled whole, in its cover colour (or its paper tone): all 125 spines, then the 3 page edges.
  const cells = calls
    .filter(({ name, args }) => name === 'fillRect' && args[2] === ATLAS.cellWidth && args[3] === ATLAS.cellHeight)
    .map(({ args }) => ((args[1] as number) / ATLAS.cellHeight) * ATLAS.cols + (args[0] as number) / ATLAS.cellWidth)
  const spines = Array.from({ length: SPINE_CELLS }, (_, i) => i)
  expect(spines.filter((cell) => !cells.includes(cell))).toEqual([])
  expect(new Set(cells).size).toBe(ATLAS.cols * ATLAS.rows)
  // The same on every run: one seed decides.
  const again = recordingContext()
  paintBookAtlas(again.context)
  expect(again.calls).toEqual(calls)
})
