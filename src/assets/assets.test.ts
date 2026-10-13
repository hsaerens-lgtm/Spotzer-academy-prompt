// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import { CRT_SCREEN, FRAME_ARTWORK, GLASS_MATERIAL, LAPTOP, MODEL_PARTS } from '../three/assets'
import { SIZES } from '../zones/office/footprints'
import { assetManifestSchema, entryFiles, manifestFiles } from './manifest'
import { ASSET_BUDGET, ASSETS_DIR, CREDITS_FILE, modelFile } from './paths'

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

const CREDIT_ROW = /^\| (\S+) \| (\S+) \| (Poly Haven|ambientCG|Sketchfab|Khronos glTF Sample Assets) (\S+)(?: by (.+?))? \| (CC0-1\.0|CC-BY-4\.0) \| (\d+) \|$/
function credits() {
  const rows = new Map<string, { assetId: string; source: string; url: string; author?: string; licence: string; bytes: number }>()
  for (const line of readFileSync(join(ASSETS, CREDITS_FILE), 'utf8').split('\n')) {
    const match = CREDIT_ROW.exec(line.trimEnd())
    if (match) rows.set(match[1], { assetId: match[2], source: match[3], url: match[4], author: match[5], licence: match[6], bytes: Number(match[7]) })
  }
  return rows
}

// CC BY 4.0: every Sketchfab model is credited in the site too, by title and author (reading mode, credits.models).
test('every CC BY model is credited in the site by its title and author', () => {
  const ui = JSON.parse(readFileSync(join(ROOT, 'content/en/ui.json'), 'utf8')) as { credits: { models: string } }
  for (const entry of models) {
    if (!('author' in entry)) continue
    expect(ui.credits.models, entry.id).toContain(entry.title)
    expect(ui.credits.models, entry.id).toContain(entry.author)
  }
  expect(ui.credits.models).toContain('CC BY 4.0')
})

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

test('every file in public/assets is listed in CREDITS.md with its licence, its author when CC BY, and its exact size', () => {
  const rows = credits()
  const files = listFiles().filter((file) => file !== CREDITS_FILE)
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const row = rows.get(file)
    expect(row, file).toBeDefined()
    expect(row!.bytes, file).toBe(sizeOf(file))
    const entry = manifest.assets.find((asset) => entryFiles(asset).includes(file))
    expect(entry, file).toBeDefined()
    expect(row!.assetId).toBe(entry!.id)
    expect(row!.licence, file).toBe(entry!.licence)
    expect(row!.author, file).toBe('author' in entry! ? entry!.author : undefined)
    expect(row!.source).toBe({ polyhaven: 'Poly Haven', ambientcg: 'ambientCG', sketchfab: 'Sketchfab', khronos: 'Khronos glTF Sample Assets' }[entry!.source])
    expect(row!.url).toBe(
      {
        polyhaven: `https://polyhaven.com/a/${entry!.sourceId}`,
        ambientcg: `https://ambientcg.com/view?id=${entry!.sourceId}`,
        sketchfab: `https://sketchfab.com/3d-models/${entry!.sourceId}`,
        khronos: `https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/${entry!.sourceId}`,
      }[entry!.source],
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
    // No light of its own (the office's rig lights the room) and one material per mesh, not a set of colour variants.
    expect(used, entry.id).not.toContain('KHR_lights_punctual')
    expect(used, entry.id).not.toContain('KHR_materials_variants')
    const textures = (await readModel(entry.id)).getRoot().listTextures()
    expect(textures.length, entry.id).toBeGreaterThan(0)
    for (const texture of textures) expect(texture.getMimeType(), entry.id).toBe('image/webp')
  }
}, 60_000)

// Task 11: a hovered model gets drei's Outlines on each mesh. Outlines draws an indexed geometry from a non-indexed copy
// of its own, which it disposes on unhover; a non-indexed geometry it would use and dispose as is, although the loader
// cache shares it with every copy of the model. Skinned meshes would take its skinned path instead.
test('every model primitive is indexed and no model is skinned', async () => {
  const files = listFiles().filter((file) => /^models\/[^/]+\.glb$/.test(file))
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const root = (await readModel(file.slice('models/'.length, -'.glb'.length))).getRoot()
    expect(root.listSkins(), file).toEqual([])
    const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives())
    expect(primitives.length, file).toBeGreaterThan(0)
    for (const primitive of primitives) {
      expect(primitive.getIndices(), `${file}, material ${primitive.getMaterial()?.getName()}`).not.toBeNull()
    }
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

test('the pendant has its bulb and shell materials and the frame its artwork material', async () => {
  const materials = async (id: string) => (await readModel(id)).getRoot().listMaterials().map((material) => material.getName())
  const pendant = await materials('modern_ceiling_lamp_01')
  expect(pendant).toContain(MODEL_PARTS.pendantBulb)
  expect(pendant.filter((name) => GLASS_MATERIAL.test(name))).toEqual([MODEL_PARTS.pendantShell])
  expect(await materials('hanging_picture_frame_01')).toContain(MODEL_PARTS.frameArtwork)
  expect((await materials('wall_clock')).filter((name) => GLASS_MATERIAL.test(name))).toEqual(['wall_clock_glass'])
})

// The layout's footprint of a meeting chair is the dining chair model's size, as loaded (in metres, unscaled).
test('the meeting chair model measures SIZES.chair', async () => {
  const bounds = getBounds((await readModel('dining_chair_02')).getRoot().listScenes()[0])
  SIZES.chair.forEach((expected, k) => expect(Math.abs(bounds.max[k] - bounds.min[k] - expected), `axis ${k}`).toBeLessThan(0.01))
})

// The layout's footprint of the sofa is the velvet sofa model's size, as loaded (in metres, unscaled).
test('the sofa model measures SIZES.sofa', async () => {
  const bounds = getBounds((await readModel('glam_velvet_sofa')).getRoot().listScenes()[0])
  SIZES.sofa.forEach((expected, k) => expect(Math.abs(bounds.max[k] - bounds.min[k] - expected), `axis ${k}`).toBeLessThan(0.01))
})

// The laptop is scaled to LAPTOP.height; the workshop preview covers its screen glass (LaptopModel.tsx).
test('the laptop screen glass is where LAPTOP.screen says, once the laptop is scaled and normalised', async () => {
  const document = await readModel('classic_laptop')
  const scene = document.getRoot().listScenes()[0]
  const bounds = getBounds(scene)
  const scale = LAPTOP.height / (bounds.max[1] - bounds.min[1])
  const node = document.getRoot().listNodes().find((n) => n.getMesh()?.listPrimitives().some((p) => p.getMaterial()?.getName() === MODEL_PARTS.laptopScreen))!
  const glass = node.getMesh()!.listPrimitives().find((primitive) => primitive.getMaterial()?.getName() === MODEL_PARTS.laptopScreen)!
  expect(glass.getMaterial()!.getAlphaMode()).toBe('OPAQUE')
  const position = glass.getAttribute('POSITION')!
  const world = node.getWorldMatrix()
  const [min, max, p] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity], [] as number[]]
  for (let i = 0; i < position.getCount(); i++) {
    position.getElement(i, p)
    const v = [0, 1, 2].map((r) => world[r] * p[0] + world[4 + r] * p[1] + world[8 + r] * p[2] + world[12 + r])
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[k])
      max[k] = Math.max(max[k], v[k])
    }
  }
  // Normalised: standing on y = 0, centred on x and z; then scaled about that origin.
  const centre = [((min[0] + max[0]) / 2 - (bounds.min[0] + bounds.max[0]) / 2) * scale, ((min[1] + max[1]) / 2 - bounds.min[1]) * scale, (max[2] - (bounds.min[2] + bounds.max[2]) / 2) * scale]
  centre.forEach((value, k) => expect(Math.abs(value - LAPTOP.screen.center[k]), `centre axis ${k}`).toBeLessThan(0.002))
  expect(Math.abs((max[0] - min[0]) * scale - LAPTOP.screen.width)).toBeLessThan(0.002)
  expect(Math.abs((max[1] - min[1]) * scale - LAPTOP.screen.height)).toBeLessThan(0.002)
})

// The posters are painted at the artwork's proportions (decor/posters.ts): its size, in metres, as the scene shows it.
test('the frame artwork measures FRAME_ARTWORK', async () => {
  const [node] = (await readModel('hanging_picture_frame_01')).getRoot().listNodes()
  const artwork = node.getMesh()!.listPrimitives().find((primitive) => primitive.getMaterial()?.getName() === MODEL_PARTS.frameArtwork)!
  const position = artwork.getAttribute('POSITION')!
  const [min, max, corner] = [[Infinity, Infinity], [-Infinity, -Infinity], [] as number[]]
  for (let i = 0; i < position.getCount(); i++) {
    position.getElement(i, corner)
    for (const axis of [0, 1]) {
      min[axis] = Math.min(min[axis], corner[axis])
      max[axis] = Math.max(max[axis], corner[axis])
    }
  }
  const [scaleX, scaleY] = node.getScale()
  expect((max[0] - min[0]) * scaleX).toBeCloseTo(FRAME_ARTWORK.width, 3)
  expect((max[1] - min[1]) * scaleY).toBeCloseTo(FRAME_ARTWORK.height, 3)
})

test('the clock glass stays alpha-blended at 0.4 once the transmission extension is stripped', async () => {
  const glass = (await readModel('wall_clock')).getRoot().listMaterials().find((material) => material.getName() === 'wall_clock_glass')
  expect(glass).toBeDefined()
  expect(glass!.getAlphaMode()).toBe('BLEND')
  expect(glass!.getBaseColorFactor()[3]).toBeCloseTo(0.4, 5)
})

// Nothing transparent may stand in front of the wall screen's DOM hole, and the pendants overlap its corner.
test('the pendant shells stay opaque', async () => {
  const shell = (await readModel('modern_ceiling_lamp_01')).getRoot().listMaterials().find((material) => material.getName() === 'modern_ceiling_lamp_01_glass')
  expect(shell).toBeDefined()
  expect(shell!.getAlphaMode()).toBe('OPAQUE')
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
