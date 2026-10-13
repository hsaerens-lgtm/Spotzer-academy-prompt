// Downloads the source files of every asset in manifest.json into assets-src/<id>/ (ignored by git).
// Usage: npm run assets:fetch [-- --only id1,id2]
// Everything that comes from the network is untrusted: https on allowed hosts only (every redirect checked before it is
// followed), write paths kept under assets-src/<id>/, sizes counted on the bytes received, zips inflated within their declared size.
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  AMBIENTCG_MAPS,
  ATTRIBUTED_SOURCES,
  MAX_API_BYTES,
  MAX_DOWNLOAD,
  ambientCgDownload,
  assertDownloadPlan,
  assertSafeManifest,
  byteLimit,
  fetchAllowed,
  formatMiB,
  polyHavenModelDownloads,
  polyHavenTextureDownloads,
  readBody,
  readZip,
  safeJoin,
  sourceResolutionKey,
} from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCES = join(ROOT, 'assets-src')
const HEADERS = { 'user-agent': 'athena-prompt-academy asset fetch (CC0 assets, run by hand)' }
const API_TIMEOUT_MS = 60_000
const FILE_TIMEOUT_MS = 300_000
const REQUIRED_AMBIENTCG_MAPS = ['color', 'normal', 'roughness']

const { values } = parseArgs({ options: { only: { type: 'string' }, help: { type: 'boolean', default: false } } })
if (values.help) {
  console.log('Usage: npm run assets:fetch [-- --only id1,id2]')
  console.log('Downloads the sources listed in scripts/assets/manifest.json into assets-src/<id>/.')
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8'))
try {
  assertSafeManifest(manifest)
} catch (error) {
  console.error(`assets:fetch failed: ${error.message}`)
  process.exit(1)
}
const only = values.only ? new Set(values.only.split(',').map((id) => id.trim())) : null
const unknown = only ? [...only].filter((id) => !manifest.assets.some((entry) => entry.id === id)) : []
if (unknown.length > 0) {
  console.error(`Unknown asset id(s): ${unknown.join(', ')}`)
  process.exit(1)
}

async function getJson(url) {
  const response = await fetchAllowed(url, { headers: HEADERS, signal: AbortSignal.timeout(API_TIMEOUT_MS) })
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`)
  const body = await readBody(Readable.fromWeb(response.body), MAX_API_BYTES, url)
  return JSON.parse(body.toString('utf8'))
}

function md5Of(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex')
}

/**
 * Downloads one file to its place under assets-src/<id>/, through a .part file; skips a file already there with the right size.
 * The size the API announced is the limit of what is written: the body is counted as it arrives and cut when it passes it.
 */
async function download(id, file) {
  const target = safeJoin(join(SOURCES, id), file.path)
  if (existsSync(target) && statSync(target).size === file.size) return { bytes: file.size, skipped: true }
  mkdirSync(dirname(target), { recursive: true })
  const part = `${target}.part`
  try {
    const response = await fetchAllowed(file.url, { headers: HEADERS, signal: AbortSignal.timeout(FILE_TIMEOUT_MS) })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
    const header = response.headers.get('content-length')
    if (header !== null) {
      if (!/^\d+$/.test(header)) throw new Error(`invalid content-length ${JSON.stringify(header)}`)
      if (Number(header) > MAX_DOWNLOAD) throw new Error(`announced at ${formatMiB(Number(header))}, over the ${formatMiB(MAX_DOWNLOAD)} limit`)
    }
    await pipeline(Readable.fromWeb(response.body), byteLimit(Math.min(file.size, MAX_DOWNLOAD), file.path), createWriteStream(part))
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
  const entries = readZip(readFileSync(safeJoin(folder, 'source.zip')))
  for (const [map, pattern] of Object.entries(AMBIENTCG_MAPS)) {
    const name = [...entries.keys()].find((entry) => pattern.test(entry))
    if (!name) {
      if (REQUIRED_AMBIENTCG_MAPS.includes(map)) throw new Error(`${id}: source.zip has no ${map} map`)
      continue
    }
    writeFileSync(safeJoin(folder, `${map}.jpg`), entries.get(name))
  }
}

async function downloadsFor(entry) {
  const json = await getJson(entry.api)
  let downloads
  if (entry.source === 'ambientcg') downloads = [ambientCgDownload(json, entry)]
  else if (entry.kind === 'texture') downloads = polyHavenTextureDownloads(json, entry)
  else downloads = polyHavenModelDownloads(json, sourceResolutionKey(entry))
  assertDownloadPlan(join(SOURCES, entry.id), entry.id, downloads)
  return downloads
}

let total = 0
try {
  for (const entry of manifest.assets) {
    if (only && !only.has(entry.id)) continue
    // Downloaded by hand (an account is needed), then unpacked by assets:import: nothing to fetch.
    if (ATTRIBUTED_SOURCES.includes(entry.source)) {
      console.log(`${entry.id.padEnd(26)} ${''.padStart(10)}  downloaded by hand: npm run assets:import -- --id ${entry.id} --file <download>`)
      continue
    }
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
