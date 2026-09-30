/** The brand mark (src/brand/logo-mark.svg), in SVG units, y pointing down. */
export const LOGO_RECTS = [
  { x: 0, y: 0, w: 28, h: 28, color: 'mint' },
  { x: 32, y: 0, w: 28, h: 28, color: 'ink' },
  { x: 40, y: 34, w: 8, h: 8, color: 'ink' },
  { x: 0, y: 46, w: 28, h: 32, color: 'lime' },
  { x: 32, y: 46, w: 28, h: 32, color: 'lime' },
] as const

export const LOGO_W = 60
export const LOGO_H = 78

/** Centred boxes with y pointing up, `scale` metres per SVG unit. */
export function logoBoxes(scale: number) {
  return LOGO_RECTS.map((rect) => ({
    color: rect.color,
    size: [rect.w * scale, rect.h * scale] as [number, number],
    position: [(rect.x + rect.w / 2 - LOGO_W / 2) * scale, (LOGO_H / 2 - (rect.y + rect.h / 2)) * scale] as [number, number],
  }))
}
