import { z } from 'zod'
import { LICENCE, STAGES, TEXTURE_MAPS, modelFile, textureFile, type Stage } from './paths'

/*
 * Schema of scripts/assets/manifest.json: every CC0 asset the site ships, where it comes from and how it is prepared.
 * The Node scripts read the JSON directly; src/assets/manifest.test.ts checks it against this schema.
 */

const resolution = z.union([z.literal(512), z.literal(1024), z.literal(2048)])

const common = {
  id: z.string().regex(/^[a-z0-9_]+$/),
  sourceId: z.string().min(1),
  api: z.url(),
  licence: z.literal(LICENCE),
  stage: z.enum(STAGES),
  usage: z.string().min(1).max(120),
}

/** The licence of a model downloaded by hand from Sketchfab: CC BY 4.0, its author credited (CREDITS.md and the site). */
export const ATTRIBUTION_LICENCE = 'CC-BY-4.0'

export const textureEntrySchema = z
  .object({
    kind: z.literal('texture'),
    ...common,
    source: z.enum(['polyhaven', 'ambientcg']),
    /** Real-world size of one texture repeat, in metres. */
    tileMetres: z.number().positive(),
    metal: z.boolean(),
    resolution: z.object({ color: resolution, normal: resolution, arm: resolution }).strict(),
  })
  .strict()

export const modelEntrySchema = z
  .object({
    kind: z.literal('model'),
    ...common,
    source: z.literal('polyhaven'),
    textureSize: resolution,
    /** Keep only the nodes of this variant (Poly Haven files holding `_a`, `_b`... side by side). */
    variant: z.string().regex(/^[a-z]$/).optional(),
    simplify: z.object({ ratio: z.number().gt(0).lt(1), error: z.number().positive() }).strict().optional(),
    /** false keeps the node transforms and raw vertex positions (no meshopt quantization), e.g. for the clock hands. */
    quantize: z.boolean().default(true),
  })
  .strict()

/**
 * A model downloaded by hand (`npm run assets:import`) under CC BY 4.0, so its title and author are credited: from Sketchfab
 * (source id: the model's uid) or Khronos's glTF Sample Assets (source id: its folder). Its api is its page.
 */
const attributedFields = {
  ...common,
  kind: z.literal('model'),
  licence: z.literal(ATTRIBUTION_LICENCE),
  title: z.string().min(1).max(80),
  author: z.string().min(1).max(80),
  textureSize: resolution,
  quantize: z.boolean().default(true),
}
export const attributedModelEntrySchema = z.union([
  z.object({ ...attributedFields, source: z.literal('sketchfab'), sourceId: z.string().regex(/^[0-9a-f]{32}$/) }).strict(),
  z.object({ ...attributedFields, source: z.literal('khronos'), sourceId: z.string().regex(/^[A-Za-z0-9]+$/) }).strict(),
])

export const assetEntrySchema = z.union([textureEntrySchema, modelEntrySchema, attributedModelEntrySchema])

const SOURCE_API = {
  polyhaven: (sourceId: string) => `https://api.polyhaven.com/files/${sourceId}`,
  ambientcg: (sourceId: string) => `https://ambientcg.com/api/v2/full_json?id=${sourceId}&include=downloadData`,
  sketchfab: (sourceId: string) => `https://sketchfab.com/3d-models/${sourceId}`,
  khronos: (sourceId: string) => `https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/${sourceId}`,
} as const

export const assetManifestSchema = z
  .object({ version: z.literal(1), assets: z.array(assetEntrySchema).min(1) })
  .strict()
  .superRefine((manifest, ctx) => {
    const seen = new Set<string>()
    manifest.assets.forEach((entry, index) => {
      if (seen.has(entry.id)) ctx.addIssue({ code: 'custom', path: ['assets', index, 'id'], message: `Duplicate asset id ${entry.id}` })
      seen.add(entry.id)
      if (entry.licence === LICENCE && entry.id !== entry.sourceId.toLowerCase()) {
        ctx.addIssue({ code: 'custom', path: ['assets', index, 'id'], message: 'The id must be the source id in lower case' })
      }
      if (entry.api !== SOURCE_API[entry.source](entry.sourceId)) {
        ctx.addIssue({ code: 'custom', path: ['assets', index, 'api'], message: `Expected ${SOURCE_API[entry.source](entry.sourceId)}` })
      }
      if (entry.kind === 'texture' && (entry.resolution.normal > entry.resolution.color || entry.resolution.arm > entry.resolution.color)) {
        ctx.addIssue({ code: 'custom', path: ['assets', index, 'resolution'], message: 'Normal and ARM maps are never larger than the colour map' })
      }
    })
  })

export type TextureEntry = z.infer<typeof textureEntrySchema>
export type ModelEntry = z.infer<typeof modelEntrySchema>
export type AssetEntry = z.infer<typeof assetEntrySchema>
export type AssetManifest = z.infer<typeof assetManifestSchema>

/** Files an entry produces, relative to ASSETS_DIR: the three maps of a texture, or the GLB of a model. */
export function entryFiles(entry: AssetEntry): string[] {
  return entry.kind === 'texture' ? TEXTURE_MAPS.map((map) => textureFile(entry.id, map)) : [modelFile(entry.id)]
}

/** Every file the manifest produces, in manifest order; only those of one loading stage when `stage` is given. */
export function manifestFiles(manifest: AssetManifest, stage?: Stage): string[] {
  return manifest.assets.filter((entry) => stage === undefined || entry.stage === stage).flatMap(entryFiles)
}
