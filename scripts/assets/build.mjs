// Prepares public/assets/ from assets-src/: WebP textures (sharp), meshopt-compressed GLB models (glTF-Transform),
// CREDITS.md, then prints every file with its size and checks the asset budgets.
// Usage: npm run assets:build [-- --only id]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { ASSET_BUDGET, ASSETS_DIR, CREDITS_FILE, TEXTURE_MAPS, WEBP_QUALITY, modelFile, textureFile } from '../../src/assets/paths.ts'
import { formatMiB, renderCredits } from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCES = join(ROOT, 'assets-src')
const OUT = join(ROOT, ASSETS_DIR)
/** No physical transmission in the site: three.js would render the scene a second time for it, every frame. Glass stays alpha-blended. */
const DROPPED_EXTENSIONS = ['KHR_materials_transmission', 'KHR_materials_volume']

const { values } = parseArgs({ options: { only: { type: 'string' }, help: { type: 'boolean', default: false } } })
if (values.help) {
  console.log('Usage: npm run assets:build [-- --only id]')
  console.log('Builds public/assets/ (WebP textures, meshopt GLB models, CREDITS.md) from assets-src/ and checks the budgets.')
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8'))
if (values.only && !manifest.assets.some((entry) => entry.id === values.only)) {
  console.error(`Unknown asset id: ${values.only}`)
  process.exit(1)
}

/** Same rule as entryFiles() in src/assets/manifest.ts (which Node cannot import: it needs zod and extensionless imports). */
const filesOf = (entry) => (entry.kind === 'texture' ? TEXTURE_MAPS.map((map) => textureFile(entry.id, map)) : [modelFile(entry.id)])

function source(entry, name) {
  const path = join(SOURCES, entry.id, name)
  if (!existsSync(path)) throw new Error(`${entry.id}: assets-src/${entry.id}/${name} is missing, run npm run assets:fetch first`)
  return path
}

function output(file) {
  const path = join(OUT, file)
  mkdirSync(dirname(path), { recursive: true })
  return path
}

/** One grey channel of an image at size x size, as raw bytes (one byte per pixel). */
function channel(path, size) {
  return sharp(path).resize(size, size, { fit: 'fill' }).extractChannel(0).raw().toBuffer()
}

async function buildTexture(entry) {
  const { color, normal, arm } = entry.resolution
  await sharp(source(entry, 'color.jpg'))
    .resize(color, color, { fit: 'fill' })
    .webp({ quality: WEBP_QUALITY.color })
    .toFile(output(textureFile(entry.id, 'color')))
  await sharp(source(entry, 'normal.jpg'))
    .resize(normal, normal, { fit: 'fill' })
    .webp({ quality: WEBP_QUALITY.normal })
    .toFile(output(textureFile(entry.id, 'normal')))
  if (entry.source === 'polyhaven') {
    await sharp(source(entry, 'arm.jpg'))
      .resize(arm, arm, { fit: 'fill' })
      .webp({ quality: WEBP_QUALITY.arm })
      .toFile(output(textureFile(entry.id, 'arm')))
    return
  }
  // ambientCG ships separate maps: pack them as glTF does, R = ambient occlusion, G = roughness, B = metalness.
  const folder = join(SOURCES, entry.id)
  const optional = (name, fill) => (existsSync(join(folder, name)) ? channel(join(folder, name), arm) : Buffer.alloc(arm * arm, fill))
  const [ao, roughness, metalness] = await Promise.all([
    optional('ao.jpg', 255),
    channel(source(entry, 'roughness.jpg'), arm),
    optional('metalness.jpg', 0),
  ])
  const pixels = Buffer.alloc(arm * arm * 3)
  for (let i = 0; i < arm * arm; i++) {
    pixels[i * 3] = ao[i]
    pixels[i * 3 + 1] = roughness[i]
    pixels[i * 3 + 2] = metalness[i]
  }
  await sharp(pixels, { raw: { width: arm, height: arm, channels: 3 } })
    .webp({ quality: WEBP_QUALITY.arm })
    .toFile(output(textureFile(entry.id, 'arm')))
}

let io = null
async function modelIO() {
  if (!io) {
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready])
    io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
  }
  return io
}

async function buildModel(entry) {
  const io = await modelIO()
  const document = await io.read(source(entry, 'model.gltf'))
  const root = document.getRoot()
  for (const extension of [...root.listExtensionsUsed()]) {
    if (DROPPED_EXTENSIONS.includes(extension.extensionName)) extension.dispose()
  }
  if (entry.variant) {
    for (const node of [...root.listNodes()]) {
      const name = node.getName()
      if (/_[a-z]$/.test(name) && !name.endsWith(`_${entry.variant}`)) node.dispose()
    }
  }
  const size = entry.textureSize
  // keepUniqueNames: the site finds materials by name (the *_glass ones, the pendant bulb, the frame artwork), even identical ones.
  // keepSolidTextures: every model material keeps its maps (the material audit counts them).
  const transforms = [dedup({ keepUniqueNames: true }), prune({ keepSolidTextures: true }), weld()]
  if (entry.simplify) {
    transforms.push(simplify({ simplifier: MeshoptSimplifier, ratio: entry.simplify.ratio, error: entry.simplify.error }))
  }
  transforms.push(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: WEBP_QUALITY.color, slots: /^(?!normalTexture).*$/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: WEBP_QUALITY.normal, slots: /^normalTexture$/ }),
  )
  // Quantization moves the vertices into node transforms: the clock keeps raw positions so its hands turn about the dial centre.
  if (entry.quantize !== false) transforms.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  await document.transform(...transforms)
  writeFileSync(output(modelFile(entry.id)), await io.writeBinary(document))
}

try {
  for (const entry of manifest.assets) {
    if (values.only && entry.id !== values.only) continue
    if (entry.kind === 'texture') await buildTexture(entry)
    else await buildModel(entry)
    console.log(`built ${entry.id}`)
  }

  // Files the manifest no longer produces are removed, so public/assets always matches it.
  const expected = new Set(manifest.assets.flatMap(filesOf))
  for (const folder of ['textures', 'models']) {
    if (!existsSync(join(OUT, folder))) continue
    for (const file of readdirSync(join(OUT, folder))) {
      if (!expected.has(`${folder}/${file}`)) {
        rmSync(join(OUT, folder, file), { recursive: true })
        console.log(`removed ${folder}/${file} (not in the manifest)`)
      }
    }
  }

  const rows = manifest.assets.flatMap((entry) =>
    filesOf(entry).map((file) => {
      const path = join(OUT, file)
      if (!existsSync(path)) throw new Error(`${file} is missing: run npm run assets:build without --only`)
      return { file, assetId: entry.id, source: entry.source, sourceId: entry.sourceId, stage: entry.stage, bytes: statSync(path).size }
    }),
  )
  writeFileSync(join(OUT, CREDITS_FILE), renderCredits(rows))

  console.log('')
  for (const row of rows) console.log(`${row.file.padEnd(46)} ${row.stage.padEnd(6)} ${formatMiB(row.bytes).padStart(10)}`)
  const total = rows.reduce((sum, row) => sum + row.bytes, statSync(join(OUT, CREDITS_FILE)).size)
  const base = rows.filter((row) => row.stage === 'base').reduce((sum, row) => sum + row.bytes, 0)
  const largest = rows.reduce((max, row) => (row.bytes > max.bytes ? row : max))
  console.log('')
  console.log(`total (public/assets)   ${formatMiB(total)} / ${formatMiB(ASSET_BUDGET.totalBytes)}`)
  console.log(`first image (base)      ${formatMiB(base)} / ${formatMiB(ASSET_BUDGET.baseBytes)}`)
  console.log(`largest file            ${formatMiB(largest.bytes)} (${largest.file}), must stay under ${formatMiB(ASSET_BUDGET.maxFileBytes)}`)

  const failures = []
  if (total > ASSET_BUDGET.totalBytes) failures.push(`public/assets is ${formatMiB(total)}, over ${formatMiB(ASSET_BUDGET.totalBytes)}`)
  if (base > ASSET_BUDGET.baseBytes) failures.push(`the first-image (base) assets are ${formatMiB(base)}, over ${formatMiB(ASSET_BUDGET.baseBytes)}`)
  for (const row of rows) {
    if (row.bytes >= ASSET_BUDGET.maxFileBytes) failures.push(`${row.file} is ${formatMiB(row.bytes)}, files must stay under ${formatMiB(ASSET_BUDGET.maxFileBytes)}`)
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`Asset budget exceeded: ${failure}`)
    process.exit(1)
  }
  console.log('Asset budgets OK')
} catch (error) {
  console.error(`assets:build failed: ${error.message}`)
  process.exit(1)
}
