import { BufferAttribute, type BufferGeometry, type Material, type Mesh, type Object3D } from 'three'
import { brand } from '../../core/brand'
import { MODEL_PARTS } from '../assets'

/*
 * The retro laptop of the meeting table (classic_laptop, CC0): its screen glass shows a preview of the prompt workshop's
 * desktop, the place the laptop leads to. The glass comes flat and upright, without UVs; these helpers give it some and
 * swap its material, on the placed copy only (LaptopModel).
 */

const isScreenMaterial = (material: Material | Material[]) =>
  (Array.isArray(material) ? material : [material]).some((one) => one.name === MODEL_PARTS.laptopScreen)

/** The hover outline goes round the laptop's body and lid, not round its screen glass (a ring inside the bezel). */
export function laptopOutlined(mesh: Mesh): boolean {
  return !isScreenMaterial(mesh.material)
}

/** A copy of a flat, upright screen glass with UVs across it: u left to right (x), v bottom to top (y). */
export function screenUVs(source: BufferGeometry): BufferGeometry {
  const geometry = source.clone()
  const position = geometry.getAttribute('position')
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity]
  for (let i = 0; i < position.count; i++) {
    minX = Math.min(minX, position.getX(i))
    maxX = Math.max(maxX, position.getX(i))
    minY = Math.min(minY, position.getY(i))
    maxY = Math.max(maxY, position.getY(i))
  }
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) - minX) / (maxX - minX)
    uv[i * 2 + 1] = (position.getY(i) - minY) / (maxY - minY)
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  return geometry
}

/**
 * Puts `material` on the screen glass of a placed laptop, with a geometry of its own that has UVs (the loader's stays
 * as it is). Returns the screen mesh, whose new geometry the caller disposes, or null when the model has no screen.
 */
export function fitLaptopScreen(root: Object3D, material: Material): Mesh | null {
  let screen: Mesh | null = null
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!screen && mesh.isMesh && isScreenMaterial(mesh.material)) screen = mesh
  })
  if (!screen) return null
  const found = screen as Mesh
  found.geometry = screenUVs(found.geometry)
  found.material = material
  return found
}

/**
 * The workshop's retro desktop, in miniature and without a letter: an ink desktop with its dot grid, three icons, a
 * secondary window behind a primary one with a lime title bar holding a stack of prompt blocks, and the taskbar with a
 * lime start button. Drawn on any 2D context (a recording one in the tests).
 */
export function paintWorkshopPreview(g: CanvasRenderingContext2D, w: number, h: number): void {
  const unit = w / 48
  g.fillStyle = brand.ink
  g.fillRect(0, 0, w, h)
  g.fillStyle = brand.surface3
  for (let y = unit; y < h; y += unit * 1.4) for (let x = unit; x < w; x += unit * 1.4) g.fillRect(x, y, unit * 0.18, unit * 0.18)
  // Desktop icons down the left edge.
  for (let k = 0; k < 3; k++) {
    g.fillStyle = k === 0 ? brand.lime : brand.mint
    g.fillRect(unit * 1.5, unit * (2 + k * 5), unit * 3.4, unit * 2.8)
    g.fillStyle = brand.surface2
    g.fillRect(unit * 1.8, unit * (2.3 + k * 5), unit * 2.8, unit * 2.2)
  }
  const panel = (x: number, y: number, ww: number, wh: number, bar: string) => {
    g.fillStyle = brand.blueGrey
    g.fillRect(x - unit * 0.2, y - unit * 0.2, ww + unit * 0.4, wh + unit * 0.4)
    g.fillStyle = brand.surface1
    g.fillRect(x, y, ww, wh)
    g.fillStyle = bar
    g.fillRect(x, y, ww, unit * 1.6)
  }
  // A secondary window behind, then the primary one in front.
  panel(unit * 21, unit * 3, unit * 24, unit * 15, brand.blueGrey)
  panel(unit * 8, unit * 8, unit * 26, unit * 20, brand.lime)
  // Prompt blocks stacked in the primary window, and lines of text as bars beside them.
  const blocks = [brand.lime, brand.mint, brand.blueGrey, brand.mint]
  blocks.forEach((colour, k) => {
    g.fillStyle = colour
    g.fillRect(unit * 10, unit * (11 + k * 3.6), unit * (7 + (k % 2) * 2), unit * 2.6)
  })
  g.fillStyle = brand.surface3
  for (let k = 0; k < 6; k++) g.fillRect(unit * 21, unit * (11.2 + k * 2.4), unit * (10 - (k % 3) * 2), unit * 1)
  // The taskbar along the bottom edge, its start button in lime.
  const bar = unit * 2.6
  g.fillStyle = brand.surface1
  g.fillRect(0, h - bar, w, bar)
  g.fillStyle = brand.lime
  g.fillRect(unit * 0.6, h - bar + unit * 0.5, unit * 5, bar - unit)
  g.fillStyle = brand.surface3
  g.fillRect(unit * 7, h - bar + unit * 0.5, unit * 8, bar - unit)
}
