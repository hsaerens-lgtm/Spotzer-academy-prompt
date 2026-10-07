// Pure helpers of the asset pipeline (no network, no disk): unit-tested in lib.test.mjs.
import { inflateRawSync } from 'node:zlib'
import { LICENCE, MIB } from '../../src/assets/paths.ts'

/** @typedef {{ url: string, path: string, size: number, md5?: string }} Download  path is relative to assets-src/<id>/ */

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
 */
export function readZip(buffer) {
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
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt zip: bad central directory entry')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Corrupt zip: bad local header for ${name}`)
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28)
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) entries.set(name, Buffer.from(data))
    else if (method === 8) entries.set(name, inflateRawSync(data))
    else throw new Error(`Unsupported zip compression method ${method} for ${name}`)
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
