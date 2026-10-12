// Ported from Horn.os (owner's project): js/scene/books.js
import { BoxGeometry, CanvasTexture, Color, MeshStandardMaterial, SRGBColorSpace, type BufferGeometry } from 'three'
import { mergeParts, type Part } from './merge'
import { noiseTexture } from './noise'
import type { ShelfBooksSpec } from './plants/types'
import { tints } from './tints'

/*
 * Shelf books: cloth hardbacks whose boards overhang the page block, glossy paperbacks and tall art books, standing,
 * leaning and stacked. Every spine is painted into one atlas and each shelf row is baked into one geometry, so a
 * shelf is one draw call. Unlike Horn.os, the spines are abstract (colour, bands, a title bar, a mark): no text.
 */

/** 2048 x 2048 atlas: 16 x 8 cells of 128 x 256 px. The last three cells are page edges, the others spines. */
export const ATLAS = { cols: 16, rows: 8, cellWidth: 128, cellHeight: 256 } as const
const CELLS = ATLAS.cols * ATLAS.rows
const PAGE_CELLS = [CELLS - 1, CELLS - 2, CELLS - 3]
/** Number of spine cells (cells 0 to SPINE_CELLS - 1). */
export const SPINE_CELLS = CELLS - PAGE_CELLS.length
/** Seed of the atlas: the spine of cell i is spineDesign(i, ATLAS_SEED). */
export const ATLAS_SEED = 42
/** Shelf depth the books must fit in (SHELVES.depth in zones/office/layout.ts; books.test.ts checks it). */
export const BOOK_SHELF_DEPTH = 0.24
/** Spines stand this far behind the front edge of the shelf; the deepest book (0.2 m) then clears the wall. */
const FRONT_INSET = 0.03
/** Smallest luminance difference (linear) between a cover and its ink: the bands and marks must read. */
export const INK_CONTRAST = 0.25

export type BookKind = 'paperback' | 'hardback' | 'art'
/**
 * One spine: `cover` and `ink` index tints.bookCovers and tints.bookInks; `bands` are horizontal rules across the
 * spine, `y` and `h` as fractions of the spine height from its head. Abstract on purpose: a design never holds text.
 */
export interface SpineDesign {
  cover: number
  ink: number
  bands: { y: number; h: number }[]
  kind: BookKind
}

/** Horn.os' LCG: numbers in [0, 1), the same sequence for the same seed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const luminance = (colour: string) => {
  const c = new Color(colour)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

/** The design of spine cell `index`, the same on every run for the same seed. */
export function spineDesign(index: number, seed: number): SpineDesign {
  const rand = seeded(seed * 1000003 + index * 7919)
  rand()
  const roll = rand()
  const kind: BookKind = roll < 0.45 ? 'paperback' : roll < 0.85 ? 'hardback' : 'art'
  const cover = Math.floor(rand() * tints.bookCovers.length)
  const coverLum = luminance(tints.bookCovers[cover])
  const readable = tints.bookInks.map((ink, i) => ({ i, d: Math.abs(luminance(ink) - coverLum) })).filter(({ d }) => d >= INK_CONTRAST)
  const ink = readable[Math.floor(rand() * readable.length)].i
  let bands: { y: number; h: number }[]
  if (kind === 'hardback') {
    // Gilt rules at head and tail.
    bands = [
      { y: 0.047, h: 0.01 },
      { y: 0.07, h: 0.004 },
      { y: 0.926, h: 0.004 },
      { y: 0.945, h: 0.01 },
    ]
  } else if (kind === 'art') {
    // Raised bands, as on a leather binding.
    bands = [0.086, 0.234, 0.766, 0.914].map((y) => ({ y: y - 0.012, h: 0.024 }))
  } else {
    // A paperback: a broad colour block across the spine, or nothing.
    bands = rand() < 0.35 ? [{ y: 0.66, h: 0.2 }] : []
  }
  return { cover, ink, bands, kind }
}

/** Spine cells of each kind, from the atlas designs. */
let cellsByKind: Record<BookKind, number[]> | null = null
function spineCells(kind: BookKind): number[] {
  if (!cellsByKind) {
    cellsByKind = { paperback: [], hardback: [], art: [] }
    for (let i = 0; i < SPINE_CELLS; i++) cellsByKind[spineDesign(i, ATLAS_SEED).kind].push(i)
  }
  return cellsByKind[kind]
}

/* ------------------------------------------------------------------ *
 *  Atlas (DOM: canvas)
 * ------------------------------------------------------------------ */

function paintSpine(g: CanvasRenderingContext2D, x0: number, y0: number, design: SpineDesign, rand: () => number) {
  const W = ATLAS.cellWidth
  const H = ATLAS.cellHeight
  const cover = tints.bookCovers[design.cover]
  const ink = tints.bookInks[design.ink]
  g.fillStyle = cover
  g.fillRect(x0, y0, W, H)
  if (design.kind === 'hardback') {
    // Cloth: a fine weave.
    for (let y = 0; y < H; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.04})`
      g.fillRect(x0, y0 + y, W, 1)
    }
    for (let x = 0; x < W; x += 2) {
      g.fillStyle = `rgba(255,255,255,${0.025 + rand() * 0.03})`
      g.fillRect(x0 + x, y0, 1, H)
    }
  } else if (design.kind === 'art') {
    // Leather: a mottled grain, and a darker label panel between the raised bands.
    for (let k = 0; k < 260; k++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'
      g.beginPath()
      g.ellipse(x0 + rand() * W, y0 + rand() * H, 1 + rand() * 4, 1 + rand() * 3, rand() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = 'rgba(0,0,0,0.45)'
    g.fillRect(x0 + 10, y0 + 74, W - 20, H - 150)
    g.strokeStyle = ink
    g.lineWidth = 1.5
    g.strokeRect(x0 + 14, y0 + 78, W - 28, H - 158)
  } else {
    // Paper: a glossy sheen across the spine.
    const sheen = g.createLinearGradient(x0, 0, x0 + W, 0)
    sheen.addColorStop(0.3, 'rgba(255,255,255,0)')
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.12)')
    sheen.addColorStop(0.6, 'rgba(255,255,255,0)')
    g.fillStyle = sheen
    g.fillRect(x0, y0, W, H)
  }
  g.fillStyle = ink
  for (const band of design.bands) {
    if (design.kind === 'art') {
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(x0, y0 + band.y * H, W, band.h * H)
      g.fillStyle = ink
      g.fillRect(x0 + 6, y0 + band.y * H, W - 12, 1.5)
      g.fillRect(x0 + 6, y0 + (band.y + band.h) * H - 1.5, W - 12, 1.5)
    } else {
      g.globalAlpha = design.kind === 'paperback' ? 0.9 : 1
      g.fillRect(x0 + (design.kind === 'paperback' ? 0 : 6), y0 + band.y * H, W - (design.kind === 'paperback' ? 0 : 12), band.h * H)
      g.globalAlpha = 1
    }
  }
  // Where a title would be: an abstract bar up the spine, and a short one at the foot. Never letters.
  g.fillStyle = ink
  const bar = design.kind === 'art' ? 0.34 : 0.4 + ((design.cover + design.ink) % 3) * 0.06
  g.globalAlpha = 0.85
  g.fillRect(x0 + W * 0.42, y0 + H * (0.46 - bar / 2), W * 0.16, H * bar)
  g.fillRect(x0 + W * 0.44, y0 + H * 0.8, W * 0.12, H * 0.07)
  g.globalAlpha = 1
  if (design.kind === 'paperback') {
    // A publisher's mark: a plain disc.
    g.beginPath()
    g.arc(x0 + W / 2, y0 + H - 18, 8, 0, Math.PI * 2)
    g.fill()
  }
  // A rounded spine: shaded toward both edges, a little wear at head and tail.
  const round = g.createLinearGradient(x0, 0, x0 + W, 0)
  round.addColorStop(0, 'rgba(0,0,0,0.38)')
  round.addColorStop(0.18, 'rgba(0,0,0,0.05)')
  round.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  round.addColorStop(0.82, 'rgba(0,0,0,0.05)')
  round.addColorStop(1, 'rgba(0,0,0,0.38)')
  g.fillStyle = round
  g.fillRect(x0, y0, W, H)
  for (let k = 0; k < 40; k++) {
    const y = rand() < 0.5 ? 8 + rand() * 10 : H - 8 - rand() * 10
    g.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.1})`
    g.fillRect(x0 + rand() * W, y0 + y, 1 + rand() * 4, 1)
  }
  // A plain swatch of the cover colour in the cell's bottom 6 px: covers and boards sample it, the spine face never does.
  g.fillStyle = cover
  g.fillRect(x0, y0 + H - 6, W, 6)
}

function paintPages(g: CanvasRenderingContext2D, x0: number, y0: number, tone: string, rand: () => number) {
  g.fillStyle = tone
  g.fillRect(x0, y0, ATLAS.cellWidth, ATLAS.cellHeight)
  for (let y = 0; y < ATLAS.cellHeight; y += 1.5) {
    g.fillStyle = `rgba(90,70,40,${0.04 + rand() * 0.08})`
    g.fillRect(x0, y0 + y, ATLAS.cellWidth, 0.7)
  }
  const edge = g.createLinearGradient(0, y0, 0, y0 + ATLAS.cellHeight)
  edge.addColorStop(0, 'rgba(120,95,60,0.18)')
  edge.addColorStop(0.1, 'rgba(0,0,0,0)')
  edge.addColorStop(0.9, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(120,95,60,0.18)')
  g.fillStyle = edge
  g.fillRect(x0, y0, ATLAS.cellWidth, ATLAS.cellHeight)
}

/**
 * Paints every cell of the atlas into `g` (2048 x 2048 px): the spines, then the page edges in the last three cells. The
 * same on every run (one seed); shapes and colours only, never text (books.test.ts records what it draws).
 */
export function paintBookAtlas(g: CanvasRenderingContext2D): void {
  const rand = seeded(ATLAS_SEED)
  for (let i = 0; i < CELLS; i++) {
    const x0 = (i % ATLAS.cols) * ATLAS.cellWidth
    const y0 = Math.floor(i / ATLAS.cols) * ATLAS.cellHeight
    const page = PAGE_CELLS.indexOf(i)
    if (page >= 0) paintPages(g, x0, y0, tints.bookPages[page], rand)
    else paintSpine(g, x0, y0, spineDesign(i, ATLAS_SEED), rand)
  }
}

let atlas: CanvasTexture | null = null

/** Every spine and page edge in one sRGB texture (2048 x 2048). Painted once, on first use (needs the DOM). */
export function bookAtlasTexture(): CanvasTexture {
  if (atlas) return atlas
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS.cols * ATLAS.cellWidth
  canvas.height = ATLAS.rows * ATLAS.cellHeight
  paintBookAtlas(canvas.getContext('2d')!)
  atlas = new CanvasTexture(canvas)
  atlas.colorSpace = SRGBColorSpace
  atlas.anisotropy = 8
  return atlas
}

let material: MeshStandardMaterial | null = null

/** The one material of every shelf of books: the atlas, with a little roughness variation. */
export function booksMaterial(): MeshStandardMaterial {
  material ??= new MeshStandardMaterial({ name: 'books', map: bookAtlasTexture(), roughness: 0.7, roughnessMap: noiseTexture({ seed: 29 }) })
  return material
}

/* ------------------------------------------------------------------ *
 *  Geometry
 * ------------------------------------------------------------------ */

interface Rect {
  u: number
  v: number
  w: number
  h: number
}
interface FaceRect extends Rect {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Atlas rectangle of a cell, in UV space (v up). */
function cellRect(cell: number): Rect {
  return { u: (cell % ATLAS.cols) / ATLAS.cols, v: 1 - (Math.floor(cell / ATLAS.cols) + 1) / ATLAS.rows, w: 1 / ATLAS.cols, h: 1 / ATLAS.rows }
}

/** Remaps the UVs of a BoxGeometry face by face (faces: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z = spine, 5 -z). */
function mapFaces(geometry: BoxGeometry, faceRect: (face: number) => FaceRect): BoxGeometry {
  const uv = geometry.getAttribute('uv')
  for (let face = 0; face < 6; face++) {
    const r = faceRect(face)
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k
      uv.setXY(i, r.u + r.w * (r.x0 + uv.getX(i) * (r.x1 - r.x0)), r.v + r.h * (r.y0 + uv.getY(i) * (r.y1 - r.y0)))
    }
  }
  return geometry
}

function paperback(w: number, h: number, d: number, spine: number, pages: number): BoxGeometry[] {
  const s = cellRect(spine)
  const p = cellRect(pages)
  return [
    mapFaces(new BoxGeometry(w, h, d), (f) =>
      f === 4
        ? { ...s, x0: 0.02, x1: 0.98, y0: 0.035, y1: 0.99 }
        : f === 0 || f === 1
          ? { ...s, x0: 0.3, x1: 0.7, y0: 0.004, y1: 0.018 }
          : { ...p, x0: 0.05, x1: 0.95, y0: 0.05, y1: 0.95 },
    ),
  ]
}

/** A hardback: a page block inset from the boards, two boards and a spine. */
function hardback(w: number, h: number, d: number, spine: number, pages: number): BoxGeometry[] {
  const s = cellRect(spine)
  const p = cellRect(pages)
  const board = Math.min(0.0028, w * 0.12)
  const over = 0.003 // the boards overhang the pages at head, tail and fore-edge
  const cover = { ...s, x0: 0.3, x1: 0.7, y0: 0.004, y1: 0.018 }
  const block = mapFaces(new BoxGeometry(w - 2 * board, h - 2 * over, d - over - board), () => ({ ...p, x0: 0.05, x1: 0.95, y0: 0.05, y1: 0.95 }))
  block.translate(0, 0, (over - board) / 2)
  const parts = [block]
  for (const side of [-1, 1]) {
    const b = mapFaces(new BoxGeometry(board, h, d - board * 0.6), () => cover)
    b.translate(side * (w / 2 - board / 2), 0, -board * 0.3)
    parts.push(b)
  }
  const back = mapFaces(new BoxGeometry(w + 0.0008, h, board), (f) => (f === 4 ? { ...s, x0: 0, x1: 1, y0: 0.035, y1: 1 } : cover))
  back.translate(0, 0, d / 2 - board / 2)
  parts.push(back)
  return parts
}

interface Book {
  w: number
  h: number
  d: number
  kind: BookKind
}
type Run =
  | { kind: 'gap'; width: number }
  | { kind: 'stack'; type: BookKind; count: number }
  | { kind: 'row'; type?: BookKind; width?: number; lean?: boolean }

/** How a shelf is filled: a wide shelf gets a row, a stack of art books and a row of paperbacks with a leaning book. */
function shelfPlan(span: number): Run[] {
  if (span >= 0.9) {
    return [
      { kind: 'row', width: span * 0.36 },
      { kind: 'gap', width: 0.05 },
      { kind: 'stack', type: 'art', count: 3 },
      { kind: 'gap', width: 0.05 },
      { kind: 'row', type: 'paperback', lean: true },
    ]
  }
  return [
    { kind: 'gap', width: 0.03 },
    { kind: 'row', lean: true },
  ]
}

/** Room left at the end of a row for its leaning book. */
const LEAN_ROOM = 0.14
const LEAN_ANGLE = 0.32

/**
 * One shelf of books between spec.x0 and spec.x1, standing on y = spec.y, in room coordinates: spines face +z,
 * FRONT_INSET behind the front edge of a shelf BOOK_SHELF_DEPTH deep centred on spec.z. UVs point into the atlas.
 */
export function shelfBooksGeometry(spec: ShelfBooksSpec): BufferGeometry {
  const rand = seeded(spec.seed)
  const front = spec.z + BOOK_SHELF_DEPTH / 2 - FRONT_INSET
  const parts: Part[] = []
  const sizes: Record<BookKind, () => Book> = {
    paperback: () => ({ w: 0.016 + rand() * 0.014, h: 0.18 + rand() * 0.025, d: 0.12 + rand() * 0.015, kind: 'paperback' }),
    hardback: () => ({ w: 0.026 + rand() * 0.022, h: 0.225 + rand() * 0.04, d: 0.15 + rand() * 0.03, kind: 'hardback' }),
    art: () => ({ w: 0.018 + rand() * 0.02, h: 0.29 + rand() * 0.04, d: 0.18 + rand() * 0.02, kind: 'art' }),
  }
  const pick = (cells: readonly number[]) => cells[Math.floor(rand() * cells.length)]
  const build = (b: Book) => (b.kind === 'paperback' ? paperback : hardback)(b.w, b.h, b.d, pick(spineCells(b.kind)), pick(PAGE_CELLS))
  const place = (geometries: BoxGeometry[], move: (g: BoxGeometry) => void) => {
    for (const geometry of geometries) {
      move(geometry)
      parts.push({ geometry })
    }
  }
  let x = spec.x0
  for (const run of shelfPlan(spec.x1 - spec.x0)) {
    if (run.kind === 'gap') {
      x += run.width
      continue
    }
    if (run.kind === 'stack') {
      // Books lying flat, largest at the bottom, spines to the room; skipped when it does not fit.
      // Each book is pushed back by up to 8 mm and slid right by up to 1.2 cm: never past the front or the stack's end.
      const books = Array.from({ length: run.count }, (_, i) => {
        const b = sizes[run.type]()
        b.h *= 1 - i * 0.05
        b.d *= 1 - i * 0.04
        return { b, dx: rand() * 0.012, dz: rand() * 0.008 }
      })
      const length = Math.max(...books.map(({ b }) => b.h)) + 0.012
      if (x + length > spec.x1) continue
      let y = spec.y
      for (const { b, dx, dz } of books) {
        const bottom = y
        place(build(b), (g) => g.rotateZ(-Math.PI / 2).translate(x + dx + b.h / 2, bottom + b.w / 2, front - dz - b.d / 2))
        y += b.w
      }
      x += length + 0.012
      continue
    }
    // A standing row, spines not quite in line.
    const end = Math.min(spec.x1 - (run.lean ? LEAN_ROOM : 0), x + (run.width ?? spec.x1 - x))
    while (x < end - 0.02) {
      const b = sizes[run.type ?? (rand() < 0.55 ? 'hardback' : 'paperback')]()
      if (x + b.w > end) break
      const back = rand() * 0.008
      const at = x
      place(build(b), (g) => g.translate(at + b.w / 2, spec.y + b.h / 2, front - b.d / 2 - back))
      x += b.w + 0.0012
    }
    if (run.lean) {
      // The last book of the run tipped against its neighbours, if it fits: it rests on its bottom-left edge.
      const b = sizes.hardback()
      const pivot = x + Math.sin(LEAN_ANGLE) * b.h
      if (pivot + b.w * Math.cos(LEAN_ANGLE) > spec.x1) continue
      place(build(b), (g) => g.translate(b.w / 2, b.h / 2, 0).rotateZ(LEAN_ANGLE).translate(pivot, spec.y, front - b.d / 2))
      x = pivot + b.w + 0.01
    }
  }
  const geometry = mergeParts(parts)
  for (const part of parts) part.geometry.dispose()
  return geometry
}
