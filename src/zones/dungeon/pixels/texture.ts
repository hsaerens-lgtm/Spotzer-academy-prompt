import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three'

/** Draws a grid of palette letters on a canvas, one pixel per letter ("." stays transparent, "T" takes the tint). */
export function gridToCanvas(grid: string[], palette: Record<string, string>, tint?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = grid[0].length
  canvas.height = grid.length
  const context = canvas.getContext('2d')
  if (!context) return canvas
  grid.forEach((row, y) =>
    [...row].forEach((letter, x) => {
      if (letter === '.') return
      context.fillStyle = letter === 'T' ? (tint ?? palette.o) : palette[letter]
      context.fillRect(x, y, 1, 1)
    }),
  )
  return canvas
}

/** A crisp pixel-art texture: nearest filtering both ways, no mipmaps. */
export function pixelTexture(grid: string[], palette: Record<string, string>, tint?: string): CanvasTexture {
  const texture = new CanvasTexture(gridToCanvas(grid, palette, tint))
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace
  return texture
}
