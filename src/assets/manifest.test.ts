// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assetManifestSchema, entryFiles, manifestFiles, type AssetManifest } from './manifest'

const MANIFEST_PATH = fileURLToPath(new URL('../../scripts/assets/manifest.json', import.meta.url))
const raw = (): unknown => JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const manifest: AssetManifest = assetManifestSchema.parse(raw())
const byId = (id: string) => manifest.assets.find((entry) => entry.id === id)!
/** A copy of the raw JSON, edited by `edit`, to show what the schema refuses. */
function edited(edit: (assets: Record<string, unknown>[]) => void) {
  const copy = raw() as { assets: Record<string, unknown>[] }
  edit(copy.assets)
  return assetManifestSchema.safeParse(copy).success
}

test('the asset manifest is valid', () => {
  expect(assetManifestSchema.safeParse(raw()).success).toBe(true)
  expect(manifest.assets).toHaveLength(20)
  expect(manifest.assets.every((entry) => entry.licence === 'CC0-1.0')).toBe(true)
})

test('asset ids are unique, lower case and match their source id', () => {
  const ids = manifest.assets.map((entry) => entry.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const entry of manifest.assets) expect(entry.id).toBe(entry.sourceId.toLowerCase())
  expect(byId('metal046a').sourceId).toBe('Metal046A')
  expect(edited((assets) => assets.push({ ...assets[0] }))).toBe(false)
  expect(edited((assets) => (assets[4].id = 'fabric_036'))).toBe(false)
  expect(edited((assets) => (assets[0].id = 'Plank_flooring_04'))).toBe(false)
})

test('every asset points to its source API', () => {
  for (const entry of manifest.assets) {
    const expected =
      entry.source === 'polyhaven'
        ? `https://api.polyhaven.com/files/${entry.sourceId}`
        : `https://ambientcg.com/api/v2/full_json?id=${entry.sourceId}&include=downloadData`
    expect(entry.api).toBe(expected)
  }
  expect(edited((assets) => (assets[0].api = 'https://example.com/files/plank_flooring_04'))).toBe(false)
})

test('texture resolutions follow the spec', () => {
  const textures = manifest.assets.flatMap((entry) => (entry.kind === 'texture' ? [entry] : []))
  expect(textures.map((entry) => entry.id)).toEqual([
    'plank_flooring_04',
    'beige_wall_001',
    'oak_veneer_05',
    'american_walnut_veneer',
    'fabric036',
    'carpet016',
    'metal046a',
    'metal027',
  ])
  for (const entry of textures) {
    const twoK = entry.id === 'plank_flooring_04' || entry.id === 'beige_wall_001'
    expect(entry.resolution.color).toBe(twoK ? 2048 : 1024)
    expect(entry.resolution.normal).toBeLessThanOrEqual(entry.resolution.color)
    expect(entry.resolution.arm).toBeLessThanOrEqual(entry.resolution.color)
    expect(entry.stage).toBe('base')
  }
  expect(textures.filter((entry) => entry.metal).map((entry) => entry.id)).toEqual(['metal046a', 'metal027'])
  expect(edited((assets) => ((assets[2].resolution as { normal: number }).normal = 2048))).toBe(false)
  expect(edited((assets) => ((assets[2].resolution as { normal: number }).normal = 4096))).toBe(false)
})

test('every model is a Poly Haven asset and the clock keeps its node transforms', () => {
  const models = manifest.assets.flatMap((entry) => (entry.kind === 'model' ? [entry] : []))
  expect(models).toHaveLength(12)
  expect(models.every((entry) => entry.source === 'polyhaven')).toBe(true)
  expect(models.filter((entry) => !entry.quantize).map((entry) => entry.id)).toEqual(['wall_clock'])
  expect(byId('pachira_aquatica_01')).toMatchObject({ variant: 'b', simplify: { ratio: 0.4, error: 0.01 } })
  expect(models.filter((entry) => entry.stage === 'base').map((entry) => entry.id)).toEqual([
    'modern_wooden_cabinet',
    'television_02',
    'wall_clock',
  ])
  expect(edited((assets) => (assets[8].source = 'ambientcg'))).toBe(false)
})

test('file names come from the asset ids', () => {
  expect(entryFiles(byId('fabric036'))).toEqual([
    'textures/fabric036_color.webp',
    'textures/fabric036_normal.webp',
    'textures/fabric036_arm.webp',
  ])
  expect(entryFiles(byId('wall_clock'))).toEqual(['models/wall_clock.glb'])
  expect(manifestFiles(manifest)).toHaveLength(8 * 3 + 12)
  expect(manifestFiles(manifest, 'base')).toEqual([
    ...manifest.assets.slice(0, 8).flatMap(entryFiles),
    'models/modern_wooden_cabinet.glb',
    'models/television_02.glb',
    'models/wall_clock.glb',
  ])
  expect(manifestFiles(manifest, 'decor')).toHaveLength(9)
})
