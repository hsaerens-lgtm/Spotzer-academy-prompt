// Helpers of the asset pipeline, unit-tested in lib.test.mjs. No disk access; the only network access is the
// `fetch` function that fetchAllowed is given. Everything the scripts take from the outside world (API answers,
// zip contents, redirects) goes through the checks of this file before it is trusted.
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { inflateRawSync } from 'node:zlib'
import { LICENCE, MIB } from '../../src/assets/paths.ts'

/** @typedef {{ url: string, path: string, size: number, md5?: string }} Download  path is relative to assets-src/<id>/ */

/** Largest single file we accept, announced or received. */
export const MAX_DOWNLOAD = 64 * MIB
/** Largest API (JSON) answer we accept. */
export const MAX_API_BYTES = 4 * MIB
/** Most files, and most bytes in all, that one asset may download. */
export const MAX_ASSET_FILES = 64
export const MAX_ASSET_BYTES = 2 * MAX_DOWNLOAD

/**
 * Hosts we fetch from, over https only; a subdomain of one is allowed too. Poly Haven serves its API from
 * api.polyhaven.com and its files directly from dl.polyhaven.org; ambientCG answers on ambientcg.com and
 * redirects each zip to its download host (checked with HEAD requests on every URL of the manifest, 2026-10-07).
 */
export const ALLOWED_HOSTS = ['polyhaven.com', 'polyhaven.org', 'ambientcg.com', 'acg-download.struffelproductions.com']

/** Throws unless `url` is an https URL without credentials or port, on an allowed host. Returns `url`. */
export function assertAllowedUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Not a valid URL: ${JSON.stringify(url)}`)
  }
  if (parsed.protocol !== 'https:') throw new Error(`${url}: only https URLs are fetched`)
  if (parsed.username || parsed.password || parsed.port) throw new Error(`${url}: credentials and ports are not allowed`)
  const host = parsed.hostname.toLowerCase()
  if (!ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) throw new Error(`${url}: ${host} is not an allowed host`)
  return url
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * fetch() that follows redirects by hand: the first URL and every redirect target are checked by assertAllowedUrl
 * before they are requested, so a redirect to a foreign host is never contacted. `fetchImpl` is the global fetch by default.
 */
export async function fetchAllowed(url, init = {}, fetchImpl = fetch, maxRedirects = 5) {
  let current = assertAllowedUrl(url)
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetchImpl(current, { ...init, redirect: 'manual' })
    if (!REDIRECT_STATUSES.has(response.status)) return response
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location) throw new Error(`${current}: HTTP ${response.status} without a Location header`)
    current = assertAllowedUrl(new URL(location, current).href)
  }
  throw new Error(`${url}: more than ${maxRedirects} redirects`)
}

/**
 * root joined with a path that comes from an API answer; throws unless it is a plain relative path that stays under root.
 * Refused: absolute and UNC paths, drive letters and other colons, backslashes, NUL, and any way out through "..".
 */
export function safeJoin(root, rel) {
  if (typeof rel !== 'string' || rel === '' || rel.startsWith('/') || /[\\:\0]/.test(rel)) throw new Error(`Unsafe path ${JSON.stringify(rel)}`)
  const target = resolve(root, rel)
  const inside = relative(root, target)
  if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error(`Unsafe path ${JSON.stringify(rel)}: it leaves ${root}`)
  return target
}

/**
 * A downloaded .gltf names its buffers and images by URI, and the glTF loader opens whatever those URIs say. Throws unless
 * every `buffers[].uri` and `images[].uri` is a data: URI or a plain relative path that stays under `assetDir` (the folder
 * holding the .gltf) once percent-decoded, as the loader decodes it. A missing uri (a GLB chunk, an image in a bufferView) is fine.
 */
export function assertGltfUrisContained(json, assetDir) {
  if (json === null || typeof json !== 'object') throw new Error('Not a glTF JSON document')
  for (const key of ['buffers', 'images']) {
    const list = json[key]
    if (list === undefined) continue
    if (!Array.isArray(list)) throw new Error(`glTF ${key} is not an array`)
    list.forEach((item, index) => {
      const uri = item?.uri
      if (uri === undefined) return
      const where = `${key}[${index}].uri ${JSON.stringify(uri)}`
      if (typeof uri !== 'string') throw new Error(`Unsafe glTF URI in ${where}: not a string`)
      if (/^data:/i.test(uri)) return
      // Any other scheme (http:, file:, a drive letter) is refused as it stands; an escaped colon is caught by safeJoin once decoded.
      if (/^[a-z][a-z0-9+.-]*:/i.test(uri)) throw new Error(`Unsafe glTF URI in ${where}: it has a scheme`)
      let decoded
      try {
        decoded = decodeURIComponent(uri)
      } catch {
        throw new Error(`Unsafe glTF URI in ${where}: malformed percent-encoding`)
      }
      try {
        safeJoin(assetDir, decoded)
      } catch (error) {
        throw new Error(`Unsafe glTF URI in ${where}: ${error.message}`)
      }
    })
  }
}

/**
 * Checks a list of downloads before the first byte is fetched: allowed https hosts, paths that stay under `root`,
 * a usable announced size per file (at most MAX_DOWNLOAD), and at most MAX_ASSET_FILES files and MAX_ASSET_BYTES bytes in all.
 */
export function assertDownloadPlan(root, id, downloads) {
  if (downloads.length > MAX_ASSET_FILES) throw new Error(`${id}: ${downloads.length} files to download, over the limit of ${MAX_ASSET_FILES} files`)
  let total = 0
  for (const file of downloads) {
    try {
      assertAllowedUrl(file.url)
      safeJoin(root, file.path)
    } catch (error) {
      throw new Error(`${id}: ${error.message}`)
    }
    if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error(`${id}/${file.path}: the source API announces no usable size`)
    if (file.size > MAX_DOWNLOAD) throw new Error(`${id}/${file.path}: announced at ${file.size} bytes, over the limit of ${MAX_DOWNLOAD} bytes`)
    total += file.size
  }
  if (total > MAX_ASSET_BYTES) throw new Error(`${id}: a total of ${total} bytes to download, over the limit of ${MAX_ASSET_BYTES} bytes`)
}

/**
 * Minimal check of scripts/assets/manifest.json at the start of the scripts: safe ids (they become folder names), known
 * kinds and sources, and an https API URL on an allowed host. The full zod schema (src/assets/manifest.ts) cannot be
 * imported from Node (its imports have no extension and it needs zod); src/assets/manifest.test.ts checks the file against it.
 */
export function assertSafeManifest(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.assets)) throw new Error('manifest.json: expected version 1 and an assets array')
  const seen = new Set()
  for (const entry of manifest.assets) {
    const id = entry?.id
    if (typeof id !== 'string' || !/^[a-z0-9_]+$/.test(id)) throw new Error(`manifest.json: unsafe asset id ${JSON.stringify(id)}`)
    if (seen.has(id)) throw new Error(`manifest.json: duplicate asset id ${id}`)
    seen.add(id)
    if (entry.kind !== 'texture' && entry.kind !== 'model') throw new Error(`manifest.json: ${id} has an unknown kind ${JSON.stringify(entry.kind)}`)
    if (!Object.hasOwn(SOURCE_LABEL, entry.source)) throw new Error(`manifest.json: ${id} has an unknown source ${JSON.stringify(entry.source)}`)
    try {
      assertAllowedUrl(entry.api)
    } catch (error) {
      throw new Error(`${id}: ${error.message}`)
    }
  }
}

/** A transform that passes bytes through and fails as soon as more than `maxBytes` have gone by (the body, not its announced size). */
export function byteLimit(maxBytes, label) {
  let seen = 0
  return new Transform({
    transform(chunk, _encoding, callback) {
      seen += chunk.length
      if (seen > maxBytes) callback(new Error(`${label}: more than ${maxBytes} bytes received`))
      else callback(null, chunk)
    },
  })
}

/** A whole readable as one Buffer; fails as soon as it holds more than `maxBytes`. */
export async function readBody(stream, maxBytes, label) {
  const chunks = []
  await pipeline(stream, byteLimit(maxBytes, label), async (source) => {
    for await (const chunk of source) chunks.push(chunk)
  })
  return Buffer.concat(chunks)
}

/** `extensionsUsed` as written in a GLB file (read from its JSON chunk, whatever extensions a loader knows). */
export function glbExtensionsUsed(buffer) {
  if (buffer.length < 12 || buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB file')
  if (buffer.length < 20 || buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Corrupt GLB: the first chunk is not JSON')
  const length = buffer.readUInt32LE(12)
  if (20 + length > buffer.length) throw new Error('Corrupt GLB: the JSON chunk is cut short')
  return JSON.parse(buffer.toString('utf8', 20, 20 + length)).extensionsUsed ?? []
}

/** Files found under public/assets against the files the manifest produces (both relative to it, CREDITS.md left out). */
export function auditAssetFiles(present, expected) {
  const wanted = new Set(expected)
  const found = new Set(present)
  return { unexpected: present.filter((file) => !wanted.has(file)).sort(), missing: expected.filter((file) => !found.has(file)) }
}

/** Files of an ambientCG JPG zip, by the map they hold. */
export const AMBIENTCG_MAPS = {
  color: /_Color\.jpg$/,
  normal: /_NormalGL\.jpg$/,
  roughness: /_Roughness\.jpg$/,
  ao: /_AmbientOcclusion\.jpg$/,
  metalness: /_Metalness\.jpg$/,
}

/**
 * Source resolution to download: the smallest one that still covers the largest map we produce.
 * Poly Haven keys are '1k' / '2k'; ambientCG attributes are '1K' / '2K'.
 */
export function sourceResolutionKey(entry) {
  const largest = entry.kind === 'texture' ? Math.max(entry.resolution.color, entry.resolution.normal, entry.resolution.arm) : entry.textureSize
  const key = largest > 1024 ? '2k' : '1k'
  return entry.source === 'ambientcg' ? key.toUpperCase() : key
}

const POLYHAVEN_TEXTURE_MAPS = [
  ['Diffuse', 'color.jpg'],
  ['nor_gl', 'normal.jpg'],
  ['arm', 'arm.jpg'],
]

/** @returns {Download[]} the colour, normal (OpenGL) and ARM JPGs of a Poly Haven texture. */
export function polyHavenTextureDownloads(files, entry) {
  const key = sourceResolutionKey(entry)
  return POLYHAVEN_TEXTURE_MAPS.map(([map, path]) => {
    const file = files?.[map]?.[key]?.jpg
    if (!file?.url) throw new Error(`${entry.id}: Poly Haven has no ${map} map at ${key}`)
    return { url: file.url, path, size: file.size, md5: file.md5 }
  })
}

/** @returns {Download[]} a Poly Haven glTF ('model.gltf') and every file it includes, at their relative paths. */
export function polyHavenModelDownloads(files, key = '1k') {
  const gltf = files?.gltf?.[key]?.gltf
  if (!gltf?.url) throw new Error(`Poly Haven has no glTF at ${key}`)
  return [
    { url: gltf.url, path: 'model.gltf', size: gltf.size, md5: gltf.md5 },
    ...Object.entries(gltf.include ?? {}).map(([path, file]) => ({ url: file.url, path, size: file.size, md5: file.md5 })),
  ]
}

/** @returns {Download} the JPG zip of an ambientCG material at the needed resolution. */
export function ambientCgDownload(fullJson, entry) {
  const asset = fullJson?.foundAssets?.[0]
  if (!asset || asset.assetId !== entry.sourceId) throw new Error(`${entry.id}: ambientCG did not return ${entry.sourceId}`)
  const attribute = `${sourceResolutionKey(entry)}-JPG`
  const zip = asset.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads?.find((d) => d.attribute === attribute)
  if (!zip?.downloadLink) throw new Error(`${entry.id}: ambientCG has no ${attribute} zip`)
  return { url: zip.downloadLink, path: 'source.zip', size: zip.size }
}

/**
 * Entries of a zip file, read from its central directory: Map<name, Buffer>, folders skipped.
 * Only "stored" (0) and "deflate" (8) entries exist in the zips we fetch; any other method throws.
 * A zip is untrusted input: every entry must hold exactly the number of bytes it declares, and a deflated entry is
 * never inflated past its declared size, so a small file cannot expand into memory. An entry may declare at most
 * maxEntryBytes, and all entries together at most maxTotalBytes.
 */
export function readZip(buffer, { maxEntryBytes = MAX_DOWNLOAD, maxTotalBytes = MAX_ASSET_BYTES } = {}) {
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('Not a zip file: no end of central directory')
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  if (offset === 0xffffffff) throw new Error('ZIP64 archives are not supported')
  const entries = new Map()
  let declaredTotal = 0
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt zip: bad central directory entry')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const declaredSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Corrupt zip: bad local header for ${name}`)
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28)
    if (method !== 0 && method !== 8) throw new Error(`Unsupported zip compression method ${method} for ${name}`)
    if (declaredSize > maxEntryBytes) throw new Error(`Zip entry ${name} declares ${declaredSize} bytes, over the limit of ${maxEntryBytes} bytes`)
    declaredTotal += declaredSize
    if (declaredTotal > maxTotalBytes) throw new Error(`Zip declares more than ${maxTotalBytes} bytes in total`)
    if (dataStart + compressedSize > buffer.length) throw new Error(`Corrupt zip: ${name} runs past the end of the file`)
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    let content
    if (method === 0) {
      content = Buffer.from(data)
    } else {
      try {
        // At least 1: zlib refuses a limit of 0, and an empty entry that inflates to anything is caught by the size check below.
        content = inflateRawSync(data, { maxOutputLength: Math.max(1, declaredSize) })
      } catch (error) {
        if (error.code === 'ERR_BUFFER_TOO_LARGE') throw new Error(`Zip entry ${name} inflates past its declared size of ${declaredSize} bytes`)
        throw new Error(`Corrupt zip: ${name} cannot be inflated (${error.message})`)
      }
    }
    if (content.length !== declaredSize) throw new Error(`Zip entry ${name} declares ${declaredSize} bytes but holds ${content.length}`)
    entries.set(name, content)
  }
  return entries
}

const SOURCE_LABEL = { polyhaven: 'Poly Haven', ambientcg: 'ambientCG' }

/** Page of the asset on its source site. */
export function sourceUrl(source, sourceId) {
  if (source === 'polyhaven') return `https://polyhaven.com/a/${sourceId}`
  if (source === 'ambientcg') return `https://ambientcg.com/view?id=${sourceId}`
  throw new Error(`Unknown source ${source}`)
}

/** public/assets/CREDITS.md, one row per file, sorted by file. rows: { file, assetId, source, sourceId, bytes }[] */
export function renderCredits(rows) {
  const sorted = [...rows].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
  return [
    '# Asset credits',
    '',
    `All files in this folder are ${LICENCE} (public domain dedication). Generated by \`npm run assets:build\` from \`scripts/assets/manifest.json\`; do not edit by hand.`,
    '',
    '| File | Asset | Source | Licence | Bytes |',
    '|---|---|---|---|---:|',
    ...sorted.map(
      (row) => `| ${row.file} | ${row.assetId} | ${SOURCE_LABEL[row.source]} ${sourceUrl(row.source, row.sourceId)} | ${LICENCE} | ${row.bytes} |`,
    ),
    '',
  ].join('\n')
}

/** 1288490 -> '1.23 MiB' */
export function formatMiB(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`
}
