/*
 * Shared by the site, the unit tests and the Node asset scripts (scripts/assets/*.mjs import this file directly).
 * Keep it free of any import and of non-erasable TypeScript syntax (no enum, no parameter properties).
 */
export const TEXTURE_MAPS = ['color', 'normal', 'arm'] as const
export type TextureMap = (typeof TEXTURE_MAPS)[number]
export const STAGES = ['base', 'decor'] as const
export type Stage = (typeof STAGES)[number]

/** On disk, from the repository root. Vite serves it as `assets/…` (see publicUrl). */
export const ASSETS_DIR = 'public/assets'
export const CREDITS_FILE = 'CREDITS.md'
export const LICENCE = 'CC0-1.0'
export const MIB = 1024 * 1024
export const ASSET_BUDGET = { totalBytes: 18 * MIB, baseBytes: 6 * MIB, maxFileBytes: 3 * MIB } as const
export const WEBP_QUALITY = { color: 82, normal: 90, arm: 80 } as const

/** Path of a texture map, relative to ASSETS_DIR. */
export function textureFile(id: string, map: TextureMap): string {
  return `textures/${id}_${map}.webp`
}

/** Path of a model, relative to ASSETS_DIR. */
export function modelFile(id: string): string {
  return `models/${id}.glb`
}
