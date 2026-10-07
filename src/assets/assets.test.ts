// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import { CRT_SCREEN, GLASS_MATERIAL, MODEL_PARTS } from '../three/assets'
import { assetManifestSchema, entryFiles, manifestFiles } from './manifest'
import { ASSET_BUDGET, ASSETS_DIR, CREDITS_FILE, LICENCE, modelFile } from './paths'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const ASSETS = join(ROOT, ASSETS_DIR)
const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8')))
const models = manifest.assets.flatMap((entry) => (entry.kind === 'model' ? [entry] : []))

/** Every file under public/assets, relative to it, with '/' separators. */
function listFiles(dir = ASSETS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name)
    return item.isDirectory() ? listFiles(path) : [relative(ASSETS, path).split(sep).join('/')]
  })
}
const sizeOf = (file: string) => statSync(join(ASSETS, file)).size
const sum = (files: string[]) => files.reduce((total, file) => total + sizeOf(file), 0)

const CREDIT_ROW = /^\| (\S+) \| (\S+) \| (Poly Haven|ambientCG) (\S+) \| (CC0-1\.0) \| (\d+) \|$/
function credits() {
  const rows = new Map<string, { assetId: string; source: string; url: string; licence: string; bytes: number }>()
  for (const line of readFileSync(join(ASSETS, CREDITS_FILE), 'utf8').split('\n')) {
    const match = CREDIT_ROW.exec(line.trimEnd())
    if (match) rows.set(match[1], { assetId: match[2], source: match[3], url: match[4], licence: match[5], bytes: Number(match[6]) })
  }
  return rows
}

let io: NodeIO
beforeAll(async () => {
  await MeshoptDecoder.ready
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
})
const documents = new Map<string, Promise<Document>>()
function readModel(id: string): Promise<Document> {
  if (!documents.has(id)) documents.set(id, io.read(join(ASSETS, modelFile(id))))
  return documents.get(id)!
}
/** extensionsUsed of a GLB, read straight from its JSON chunk (header 12 bytes, chunk length, chunk type, JSON). */
function glbExtensions(id: string): string[] {
  const glb = readFileSync(join(ASSETS, modelFile(id)))
  const length = glb.readUInt32LE(12)
  return (JSON.parse(glb.toString('utf8', 20, 20 + length)) as { extensionsUsed?: string[] }).extensionsUsed ?? []
}

test('every file in public/assets is listed in CREDITS.md as CC0-1.0 with its exact size', () => {
  const rows = credits()
  const files = listFiles().filter((file) => file !== CREDITS_FILE)
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const row = rows.get(file)
    expect(row, file).toBeDefined()
    expect(row!.licence).toBe(LICENCE)
    expect(row!.bytes, file).toBe(sizeOf(file))
    const entry = manifest.assets.find((asset) => entryFiles(asset).includes(file))
    expect(entry, file).toBeDefined()
    expect(row!.assetId).toBe(entry!.id)
    expect(row!.source).toBe(entry!.source === 'polyhaven' ? 'Poly Haven' : 'ambientCG')
    expect(row!.url).toBe(
      entry!.source === 'polyhaven' ? `https://polyhaven.com/a/${entry!.sourceId}` : `https://ambientcg.com/view?id=${entry!.sourceId}`,
    )
  }
  expect([...rows.keys()].sort()).toEqual([...files].sort())
})

test('the manifest produces exactly the files in public/assets', () => {
  expect(listFiles().filter((file) => file !== CREDITS_FILE).sort()).toEqual(manifestFiles(manifest).sort())
})

test('public/assets stays within 18 MiB', () => {
  expect(sum(listFiles())).toBeLessThanOrEqual(ASSET_BUDGET.totalBytes)
})

test('assets needed for the first image stay within 6 MiB', () => {
  expect(sum(manifestFiles(manifest, 'base'))).toBeLessThanOrEqual(ASSET_BUDGET.baseBytes)
})

test('no asset file reaches 3 MiB', () => {
  for (const file of listFiles()) expect(sizeOf(file), file).toBeLessThan(ASSET_BUDGET.maxFileBytes)
})

test('models are meshopt-compressed with WebP textures and never use Draco', async () => {
  for (const entry of models) {
    const used = glbExtensions(entry.id)
    // The clock is built without quantization (its hands turn about their raw origin), hence without meshopt.
    expect(used.includes('EXT_meshopt_compression'), entry.id).toBe(entry.quantize)
    expect(used, entry.id).not.toContain('KHR_draco_mesh_compression')
    // No physical transmission either: three.js would render the scene twice for it.
    expect(used, entry.id).not.toContain('KHR_materials_transmission')
    const textures = (await readModel(entry.id)).getRoot().listTextures()
    expect(textures.length, entry.id).toBeGreaterThan(0)
    for (const texture of textures) expect(texture.getMimeType(), entry.id).toBe('image/webp')
  }
}, 60_000)

test('the clock keeps three hand nodes with identity transforms', async () => {
  const nodes = (await readModel('wall_clock')).getRoot().listNodes()
  for (const name of Object.values(MODEL_PARTS.clockHands)) {
    const node = nodes.find((candidate) => candidate.getName() === name)
    expect(node, name).toBeDefined()
    expect(node!.getMesh(), name).not.toBeNull()
    expect(node!.getTranslation(), name).toEqual([0, 0, 0])
    expect(node!.getRotation(), name).toEqual([0, 0, 0, 1])
    expect(node!.getScale(), name).toEqual([1, 1, 1])
  }
})

test('the pendant has its bulb material and the frame its artwork material', async () => {
  const materials = async (id: string) => (await readModel(id)).getRoot().listMaterials().map((material) => material.getName())
  const pendant = await materials('modern_ceiling_lamp_01')
  expect(pendant).toContain(MODEL_PARTS.pendantBulb)
  expect(pendant.filter((name) => GLASS_MATERIAL.test(name))).toEqual(['modern_ceiling_lamp_01_glass'])
  expect(await materials('hanging_picture_frame_01')).toContain(MODEL_PARTS.frameArtwork)
  expect((await materials('wall_clock')).filter((name) => GLASS_MATERIAL.test(name))).toEqual(['wall_clock_glass'])
})

test('the money tree keeps only variant b', async () => {
  const names = (await readModel('pachira_aquatica_01')).getRoot().listNodes().map((node) => node.getName())
  const variants = names.filter((name) => /_[a-z]$/.test(name))
  expect(variants.length).toBeGreaterThan(0)
  expect(variants.filter((name) => !name.endsWith('_b'))).toEqual([])
})

test('the CRT picture sits just in front of the television', async () => {
  const document = await readModel('television_02')
  const { min, max } = getBounds(document.getRoot().listScenes()[0])
  const [width, height, depth] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const [x, y, z] = CRT_SCREEN.center
  // Normalised frame (normaliseModel): standing on y = 0, centred on x and z, front face at z = depth / 2.
  const gap = z - depth / 2
  expect(gap).toBeGreaterThan(0)
  expect(gap).toBeLessThanOrEqual(0.006)
  expect(Math.abs(x) + CRT_SCREEN.width / 2).toBeLessThanOrEqual(width / 2)
  expect(y - CRT_SCREEN.height / 2).toBeGreaterThanOrEqual(0)
  expect(y + CRT_SCREEN.height / 2).toBeLessThanOrEqual(height)
})
