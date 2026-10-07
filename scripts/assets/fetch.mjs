// Downloads the source files of every asset in manifest.json into assets-src/<id>/ (ignored by git).
// Usage: npm run assets:fetch [-- --only id1,id2]
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { MIB } from '../../src/assets/paths.ts'
import {
  AMBIENTCG_MAPS,
  ambientCgDownload,
  formatMiB,
  polyHavenModelDownloads,
  polyHavenTextureDownloads,
  readZip,
  sourceResolutionKey,
} from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCES = join(ROOT, 'assets-src')
const MAX_DOWNLOAD = 64 * MIB
const HEADERS = { 'user-agent': 'athena-prompt-academy asset fetch (CC0 assets, run by hand)' }
const REQUIRED_AMBIENTCG_MAPS = ['color', 'normal', 'roughness']

const { values } = parseArgs({ options: { only: { type: 'string' }, help: { type: 'boolean', default: false } } })
if (values.help) {
  console.log('Usage: npm run assets:fetch [-- --only id1,id2]')
  console.log('Downloads the sources listed in scripts/assets/manifest.json into assets-src/<id>/.')
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8'))
const only = values.only ? new Set(values.only.split(',').map((id) => id.trim())) : null
const unknown = only ? [...only].filter((id) => !manifest.assets.some((entry) => entry.id === id)) : []
if (unknown.length > 0) {
  console.error(`Unknown asset id(s): ${unknown.join(', ')}`)
  process.exit(1)
}

async function getJson(url) {
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

function md5Of(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex')
}

/** Downloads one file to its place under assets-src/<id>/, through a .part file; skips a file already there with the right size. */
async function download(id, file) {
  if (!(file.size > 0)) throw new Error(`${id}/${file.path}: the source API gives no size`)
  if (file.size > MAX_DOWNLOAD) throw new Error(`${id}/${file.path}: announced at ${formatMiB(file.size)}, over the ${formatMiB(MAX_DOWNLOAD)} limit`)
  const target = join(SOURCES, id, file.path)
  if (existsSync(target) && statSync(target).size === file.size) return { bytes: file.size, skipped: true }
  mkdirSync(dirname(target), { recursive: true })
  const part = `${target}.part`
  try {
    const response = await fetch(file.url, { headers: HEADERS })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
    const announced = Number(response.headers.get('content-length') ?? file.size)
    if (announced > MAX_DOWNLOAD) throw new Error(`announced at ${formatMiB(announced)}, over the ${formatMiB(MAX_DOWNLOAD)} limit`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(part))
    const size = statSync(part).size
    if (size !== file.size) throw new Error(`expected ${file.size} bytes, got ${size}`)
    if (file.md5 && md5Of(part) !== file.md5) throw new Error('md5 mismatch')
    renameSync(part, target)
    return { bytes: size, skipped: false }
  } catch (error) {
    rmSync(part, { force: true })
    throw new Error(`${id}/${file.path} (${file.url}): ${error.message}`)
  }
}

/** Unpacks the maps we use from an ambientCG zip: color, normal (OpenGL), roughness, and AO / metalness when present. */
function extractAmbientCg(id) {
  const folder = join(SOURCES, id)
  const entries = readZip(readFileSync(join(folder, 'source.zip')))
  for (const [map, pattern] of Object.entries(AMBIENTCG_MAPS)) {
    const name = [...entries.keys()].find((entry) => pattern.test(entry))
    if (!name) {
      if (REQUIRED_AMBIENTCG_MAPS.includes(map)) throw new Error(`${id}: source.zip has no ${map} map`)
      continue
    }
    writeFileSync(join(folder, `${map}.jpg`), entries.get(name))
  }
}

async function downloadsFor(entry) {
  const json = await getJson(entry.api)
  if (entry.source === 'ambientcg') return [ambientCgDownload(json, entry)]
  if (entry.kind === 'texture') return polyHavenTextureDownloads(json, entry)
  return polyHavenModelDownloads(json, sourceResolutionKey(entry))
}

let total = 0
try {
  for (const entry of manifest.assets) {
    if (only && !only.has(entry.id)) continue
    let bytes = 0
    let fetched = 0
    for (const file of await downloadsFor(entry)) {
      const result = await download(entry.id, file)
      bytes += result.bytes
      if (!result.skipped) fetched++
    }
    if (entry.source === 'ambientcg') extractAmbientCg(entry.id)
    total += bytes
    console.log(`${entry.id.padEnd(26)} ${formatMiB(bytes).padStart(10)}  ${fetched > 0 ? `${fetched} file(s) downloaded` : 'already there'}`)
  }
  console.log(`${'total'.padEnd(26)} ${formatMiB(total).padStart(10)}`)
} catch (error) {
  console.error(`assets:fetch failed: ${error.message}`)
  process.exit(1)
}
