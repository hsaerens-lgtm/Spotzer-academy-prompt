// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { deflateRawSync } from 'node:zlib'
import { expect, test } from 'vitest'
import {
  MAX_ASSET_FILES,
  MAX_DOWNLOAD,
  ambientCgDownload,
  assertAllowedUrl,
  assertDownloadPlan,
  assertSafeManifest,
  auditAssetFiles,
  byteLimit,
  fetchAllowed,
  formatMiB,
  glbExtensionsUsed,
  polyHavenModelDownloads,
  polyHavenTextureDownloads,
  readBody,
  readZip,
  renderCredits,
  safeJoin,
  sourceResolutionKey,
  sourceUrl,
} from './lib.mjs'

/** A zip written by hand: one local header + data per entry, then the central directory and its end record. */
function makeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data, method } of entries) {
    const body = method === 8 ? deflateRawSync(data) : data
    const nameBytes = Buffer.from(name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, body)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + body.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

const texture = (overrides = {}) => ({
  kind: 'texture',
  id: 'plank_flooring_04',
  source: 'polyhaven',
  sourceId: 'plank_flooring_04',
  resolution: { color: 2048, normal: 1024, arm: 1024 },
  ...overrides,
})

const file = (name, size) => ({ url: `https://dl.polyhaven.org/${name}`, size, md5: `md5-${name}` })
const polyHavenTexture = {
  Diffuse: { '1k': { jpg: file('diff_1k.jpg', 1) }, '2k': { jpg: file('diff_2k.jpg', 2) } },
  nor_gl: { '1k': { jpg: file('nor_gl_1k.jpg', 3) }, '2k': { jpg: file('nor_gl_2k.jpg', 4) } },
  arm: { '1k': { jpg: file('arm_1k.jpg', 5) }, '2k': { jpg: file('arm_2k.jpg', 6) } },
  nor_dx: { '1k': { jpg: file('nor_dx_1k.jpg', 7) } },
}

test('readZip reads stored and deflated entries', () => {
  const text = Buffer.from('roughness '.repeat(200))
  const zip = makeZip([
    { name: 'Fabric036_1K-JPG_Color.jpg', data: Buffer.from([1, 2, 3, 4]), method: 0 },
    { name: 'maps/', data: Buffer.alloc(0), method: 0 },
    { name: 'Fabric036_1K-JPG_Roughness.jpg', data: text, method: 8 },
  ])
  const entries = readZip(zip)
  expect([...entries.keys()]).toEqual(['Fabric036_1K-JPG_Color.jpg', 'Fabric036_1K-JPG_Roughness.jpg'])
  expect([...entries.get('Fabric036_1K-JPG_Color.jpg')]).toEqual([1, 2, 3, 4])
  expect(entries.get('Fabric036_1K-JPG_Roughness.jpg').equals(text)).toBe(true)
})

test('readZip refuses other compression methods', () => {
  const zip = makeZip([{ name: 'a.jpg', data: Buffer.from([1]), method: 12 }])
  expect(() => readZip(zip)).toThrow(/compression method 12/)
  expect(() => readZip(Buffer.from('not a zip at all, just some bytes'))).toThrow(/Not a zip file/)
})

test('Poly Haven texture downloads pick the needed resolution', () => {
  expect(sourceResolutionKey(texture())).toBe('2k')
  expect(polyHavenTextureDownloads(polyHavenTexture, texture())).toEqual([
    { url: 'https://dl.polyhaven.org/diff_2k.jpg', path: 'color.jpg', size: 2, md5: 'md5-diff_2k.jpg' },
    { url: 'https://dl.polyhaven.org/nor_gl_2k.jpg', path: 'normal.jpg', size: 4, md5: 'md5-nor_gl_2k.jpg' },
    { url: 'https://dl.polyhaven.org/arm_2k.jpg', path: 'arm.jpg', size: 6, md5: 'md5-arm_2k.jpg' },
  ])
  const oneK = texture({ resolution: { color: 1024, normal: 1024, arm: 512 } })
  expect(sourceResolutionKey(oneK)).toBe('1k')
  expect(polyHavenTextureDownloads(polyHavenTexture, oneK).map((d) => d.url)).toEqual([
    'https://dl.polyhaven.org/diff_1k.jpg',
    'https://dl.polyhaven.org/nor_gl_1k.jpg',
    'https://dl.polyhaven.org/arm_1k.jpg',
  ])
  expect(() => polyHavenTextureDownloads({ Diffuse: polyHavenTexture.Diffuse }, oneK)).toThrow(/no nor_gl map at 1k/)
})

test('Poly Haven model downloads keep the glTF include paths', () => {
  const files = {
    gltf: {
      '1k': {
        gltf: {
          url: 'https://dl.polyhaven.org/wall_clock_1k.gltf',
          size: 9008,
          md5: 'a',
          include: {
            'wall_clock.bin': { url: 'https://dl.polyhaven.org/wall_clock.bin', size: 132412, md5: 'b' },
            'textures/wall_clock_diff_1k.jpg': { url: 'https://dl.polyhaven.org/wall_clock_diff_1k.jpg', size: 366683, md5: 'c' },
          },
        },
      },
    },
  }
  expect(sourceResolutionKey({ kind: 'model', source: 'polyhaven', textureSize: 512 })).toBe('1k')
  expect(polyHavenModelDownloads(files)).toEqual([
    { url: 'https://dl.polyhaven.org/wall_clock_1k.gltf', path: 'model.gltf', size: 9008, md5: 'a' },
    { url: 'https://dl.polyhaven.org/wall_clock.bin', path: 'wall_clock.bin', size: 132412, md5: 'b' },
    { url: 'https://dl.polyhaven.org/wall_clock_diff_1k.jpg', path: 'textures/wall_clock_diff_1k.jpg', size: 366683, md5: 'c' },
  ])
  expect(() => polyHavenModelDownloads(files, '2k')).toThrow(/no glTF at 2k/)
})

test('ambientCG downloads pick the JPG zip of the right size', () => {
  const zip = (attribute, size) => ({
    attribute,
    size,
    downloadLink: `https://ambientcg.com/get?file=Fabric036_${attribute}.zip`,
    fileName: `Fabric036_${attribute}.zip`,
  })
  const fullJson = {
    foundAssets: [
      {
        assetId: 'Fabric036',
        downloadFolders: {
          default: {
            downloadFiletypeCategories: {
              zip: { downloads: [zip('1K-PNG', 17714531), zip('1K-JPG', 9644900), zip('2K-JPG', 33928892)] },
            },
          },
        },
      },
    ],
  }
  const fabric = texture({ id: 'fabric036', source: 'ambientcg', sourceId: 'Fabric036', resolution: { color: 1024, normal: 1024, arm: 512 } })
  expect(sourceResolutionKey(fabric)).toBe('1K')
  expect(ambientCgDownload(fullJson, fabric)).toEqual({
    url: 'https://ambientcg.com/get?file=Fabric036_1K-JPG.zip',
    path: 'source.zip',
    size: 9644900,
  })
  const large = { ...fabric, resolution: { color: 2048, normal: 1024, arm: 512 } }
  expect(ambientCgDownload(fullJson, large).size).toBe(33928892)
  expect(() => ambientCgDownload(fullJson, { ...fabric, sourceId: 'Fabric039' })).toThrow(/did not return Fabric039/)
})

test('credits list every file with its source, licence and size', () => {
  const text = renderCredits([
    { file: 'textures/fabric036_arm.webp', assetId: 'fabric036', source: 'ambientcg', sourceId: 'Fabric036', bytes: 81234 },
    { file: 'models/drawer_cabinet.glb', assetId: 'drawer_cabinet', source: 'polyhaven', sourceId: 'drawer_cabinet', bytes: 612345 },
  ])
  expect(text).toBe(
    [
      '# Asset credits',
      '',
      'All files in this folder are CC0-1.0 (public domain dedication). Generated by `npm run assets:build` from `scripts/assets/manifest.json`; do not edit by hand.',
      '',
      '| File | Asset | Source | Licence | Bytes |',
      '|---|---|---|---|---:|',
      '| models/drawer_cabinet.glb | drawer_cabinet | Poly Haven https://polyhaven.com/a/drawer_cabinet | CC0-1.0 | 612345 |',
      '| textures/fabric036_arm.webp | fabric036 | ambientCG https://ambientcg.com/view?id=Fabric036 | CC0-1.0 | 81234 |',
      '',
    ].join('\n'),
  )
  const row = /^\| (\S+) \| (\S+) \| (Poly Haven|ambientCG) (\S+) \| (CC0-1\.0) \| (\d+) \|$/
  expect(text.split('\n').filter((line) => row.test(line))).toHaveLength(2)
  expect(sourceUrl('ambientcg', 'Metal046A')).toBe('https://ambientcg.com/view?id=Metal046A')
  expect(formatMiB(1288490)).toBe('1.23 MiB')
})

// ---- Fix round 1: what a hostile or broken source cannot make the scripts do ----

const ROOT = resolve('assets-src', 'wall_clock')
const HOSTILE_PATHS = ['../x', '..\\x', '/abs', '\\abs', 'C:\\x', 'C:x', 'a/../../x', '//server/share/x', '\\\\server\\share\\x', '..', '.', 'a/..', '', 'x\0y']

test('safeJoin keeps every path under its root', () => {
  expect(safeJoin(ROOT, 'textures/wall_clock_diff_1k.jpg')).toBe(resolve(ROOT, 'textures', 'wall_clock_diff_1k.jpg'))
  expect(safeJoin(ROOT, 'model.gltf')).toBe(resolve(ROOT, 'model.gltf'))
  expect(safeJoin(ROOT, 'a/../b.jpg')).toBe(resolve(ROOT, 'b.jpg'))
  for (const hostile of HOSTILE_PATHS) expect(() => safeJoin(ROOT, hostile), JSON.stringify(hostile)).toThrow(/Unsafe path/)
  expect(() => safeJoin(ROOT, 42)).toThrow(/Unsafe path/)
})

test('assertAllowedUrl accepts only https URLs on the source hosts', () => {
  for (const url of [
    'https://api.polyhaven.com/files/wall_clock',
    'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/plank_flooring_04/plank_flooring_04_diff_2k.jpg',
    'https://ambientcg.com/api/v2/full_json?id=Fabric036&include=downloadData',
    'https://ambientcg.com/get?file=Fabric036_1K-JPG.zip',
    'https://acg-download.struffelproductions.com/file/ambientCG-Web/download/Fabric036_conBCXhd/Fabric036_1K-JPG.zip',
    'https://POLYHAVEN.com/x',
  ]) {
    expect(assertAllowedUrl(url)).toBe(url)
  }
  for (const url of [
    'http://api.polyhaven.com/files/wall_clock',
    'file:///C:/Windows/win.ini',
    'ftp://dl.polyhaven.org/x',
    'https://localhost/x',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://169.254.169.254/latest/meta-data',
    'https://polyhaven.com.evil.net/x',
    'https://evilpolyhaven.com/x',
    'https://evil.net/polyhaven.com',
    'https://polyhaven.com@evil.net/x',
    'https://user:secret@dl.polyhaven.org/x',
    'https://dl.polyhaven.org:8443/x',
    'https://struffelproductions.com/x',
    'not a url',
    '',
  ]) {
    expect(() => assertAllowedUrl(url), url).toThrow()
  }
})

/** A fetch that answers from `respond(callNumber)` and records what it was asked. */
function fakeFetch(respond) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    return respond(calls.length)
  }
  impl.calls = calls
  return impl
}
const redirectTo = (location, status = 302) => new Response(null, { status, headers: { location } })

test('fetchAllowed checks every redirect target before requesting it', async () => {
  const done = new Response('zip', { status: 200 })
  const good = fakeFetch((n) => (n === 1 ? redirectTo('https://acg-download.struffelproductions.com/file/x.zip') : done))
  expect(await fetchAllowed('https://ambientcg.com/get?file=x.zip', { headers: { 'user-agent': 'test' } }, good)).toBe(done)
  expect(good.calls.map((call) => call.url)).toEqual(['https://ambientcg.com/get?file=x.zip', 'https://acg-download.struffelproductions.com/file/x.zip'])
  expect(good.calls.every((call) => call.init.redirect === 'manual' && call.init.headers['user-agent'] === 'test')).toBe(true)

  const relative = fakeFetch((n) => (n === 1 ? redirectTo('/other?file=x.zip', 301) : done))
  await fetchAllowed('https://ambientcg.com/get?file=x.zip', {}, relative)
  expect(relative.calls[1].url).toBe('https://ambientcg.com/other?file=x.zip')

  const foreign = fakeFetch((n) => (n === 1 ? redirectTo('https://evil.example.net/x.zip') : done))
  await expect(fetchAllowed('https://ambientcg.com/get?file=x.zip', {}, foreign)).rejects.toThrow(/not an allowed host/)
  expect(foreign.calls).toHaveLength(1)

  const downgrade = fakeFetch((n) => (n === 1 ? redirectTo('http://dl.polyhaven.org/x.jpg') : done))
  await expect(fetchAllowed('https://dl.polyhaven.org/x.jpg', {}, downgrade)).rejects.toThrow(/https/)
  expect(downgrade.calls).toHaveLength(1)

  const loop = fakeFetch(() => redirectTo('https://ambientcg.com/get?file=again'))
  await expect(fetchAllowed('https://ambientcg.com/get?file=x.zip', {}, loop)).rejects.toThrow(/more than 5 redirects/)
  expect(loop.calls).toHaveLength(6)

  const never = fakeFetch(() => done)
  await expect(fetchAllowed('http://ambientcg.com/get?file=x.zip', {}, never)).rejects.toThrow(/https/)
  expect(never.calls).toHaveLength(0)
})

const planned = (path, overrides = {}) => ({ url: `https://dl.polyhaven.org/${path}`, path, size: 100, md5: 'md5', ...overrides })

test('assertDownloadPlan refuses hostile paths, foreign hosts and oversized plans', () => {
  expect(() => assertDownloadPlan(ROOT, 'wall_clock', [planned('model.gltf'), planned('textures/x_1k.jpg'), planned('x.bin')])).not.toThrow()
  for (const hostile of HOSTILE_PATHS.filter((path) => path !== '')) {
    const gltf = { url: 'https://dl.polyhaven.org/m.gltf', size: 10, md5: 'a', include: { [hostile]: { url: 'https://dl.polyhaven.org/payload', size: 5, md5: 'b' } } }
    const downloads = polyHavenModelDownloads({ gltf: { '1k': { gltf } } })
    expect(() => assertDownloadPlan(ROOT, 'wall_clock', downloads), JSON.stringify(hostile)).toThrow(/wall_clock: Unsafe path/)
  }
  expect(() => assertDownloadPlan(ROOT, 'wall_clock', [planned('model.gltf', { url: 'https://evil.example.net/m.gltf' })])).toThrow(/wall_clock: .*not an allowed host/)
  expect(() => assertDownloadPlan(ROOT, 'wall_clock', [planned('model.gltf', { url: 'http://dl.polyhaven.org/m.gltf' })])).toThrow(/https/)
  for (const size of [0, -1, NaN, undefined, 1.5]) {
    expect(() => assertDownloadPlan(ROOT, 'wall_clock', [planned('model.gltf', { size })]), String(size)).toThrow(/announces no usable size/)
  }
  expect(() => assertDownloadPlan(ROOT, 'wall_clock', [planned('big.bin', { size: MAX_DOWNLOAD + 1 })])).toThrow(/over the limit of 67108864 bytes/)
  const many = Array.from({ length: MAX_ASSET_FILES + 1 }, (_, i) => planned(`textures/t${i}.jpg`))
  expect(() => assertDownloadPlan(ROOT, 'wall_clock', many)).toThrow(/65 files/)
  const heavy = ['a.bin', 'b.bin', 'c.bin'].map((path) => planned(path, { size: MAX_DOWNLOAD }))
  expect(() => assertDownloadPlan(ROOT, 'wall_clock', heavy)).toThrow(/total of 201326592 bytes/)
})

test('assertSafeManifest accepts the real manifest and refuses unsafe entries', () => {
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))
  expect(() => assertSafeManifest(manifest)).not.toThrow()
  /** The check run on a copy of the manifest edited by `change`. */
  const run = (change) => () => {
    const copy = structuredClone(manifest)
    change(copy.assets)
    assertSafeManifest(copy)
  }
  expect(run((assets) => (assets[0].id = '../evil'))).toThrow(/unsafe asset id/)
  expect(run((assets) => (assets[0].id = 'Plank_Flooring'))).toThrow(/unsafe asset id/)
  expect(run((assets) => (assets[1].id = assets[0].id))).toThrow(/duplicate asset id plank_flooring_04/)
  expect(run((assets) => (assets[0].source = 'elsewhere'))).toThrow(/unknown source/)
  expect(run((assets) => (assets[0].kind = 'script'))).toThrow(/unknown kind/)
  expect(run((assets) => (assets[0].api = 'http://api.polyhaven.com/files/plank_flooring_04'))).toThrow(/plank_flooring_04: .*https/)
  expect(run((assets) => (assets[0].api = 'https://evil.example.net/files/plank_flooring_04'))).toThrow(/plank_flooring_04: .*not an allowed host/)
  expect(() => assertSafeManifest({ version: 2, assets: [] })).toThrow(/version 1/)
  expect(() => assertSafeManifest(null)).toThrow(/version 1/)
})

/** The same zip, its central directory declaring `size` uncompressed bytes for its (only) entry. */
function declaring(zip, size) {
  const copy = Buffer.from(zip)
  copy.writeUInt32LE(size, copy.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 24)
  return copy
}

test('readZip refuses an entry that does not match the size it declares', () => {
  const zeros = Buffer.alloc(1024 * 1024)
  const bomb = makeZip([{ name: 'bomb.jpg', data: zeros, method: 8 }])
  expect(bomb.length).toBeLessThan(4096)
  expect(readZip(bomb).get('bomb.jpg').length).toBe(zeros.length)
  // Declares 100 bytes, inflates to 1 MiB: stopped by the output limit, the rest is never produced.
  expect(() => readZip(declaring(bomb, 100))).toThrow(/bomb\.jpg inflates past its declared size of 100 bytes/)
  // Declares more than it holds.
  expect(() => readZip(declaring(bomb, zeros.length + 5))).toThrow(/bomb\.jpg declares 1048581 bytes but holds 1048576/)
  const stored = makeZip([{ name: 'a.jpg', data: Buffer.from([1, 2, 3, 4]), method: 0 }])
  expect(() => readZip(declaring(stored, 2))).toThrow(/a\.jpg declares 2 bytes but holds 4/)
})

test('readZip refuses entries and archives larger than its limits', () => {
  // Honest, but a huge expansion: 8 MiB of zeros fit in a few KiB.
  const huge = makeZip([{ name: 'huge.jpg', data: Buffer.alloc(8 * 1024 * 1024), method: 8 }])
  expect(huge.length).toBeLessThan(32 * 1024)
  expect(() => readZip(huge, { maxEntryBytes: 1024 * 1024 })).toThrow(/huge\.jpg declares 8388608 bytes, over the limit of 1048576 bytes/)
  // A declared size beyond the default cap is refused without inflating anything.
  expect(() => readZip(declaring(huge, 0xffffff00))).toThrow(/over the limit of 67108864 bytes/)
  const two = makeZip([
    { name: 'a.jpg', data: Buffer.alloc(600 * 1024), method: 0 },
    { name: 'b.jpg', data: Buffer.alloc(600 * 1024), method: 0 },
  ])
  expect(readZip(two).size).toBe(2)
  expect(() => readZip(two, { maxTotalBytes: 1024 * 1024 })).toThrow(/more than 1048576 bytes in total/)
})

/** A writable that keeps what it receives. */
function sink() {
  const chunks = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk)
      callback()
    },
  })
  return { chunks, stream }
}

test('byteLimit lets the expected size through and aborts as soon as a body exceeds it', async () => {
  const ok = sink()
  await pipeline(Readable.from([Buffer.alloc(4), Buffer.alloc(4)]), byteLimit(8, 'a.jpg'), ok.stream)
  expect(Buffer.concat(ok.chunks).length).toBe(8)

  const over = sink()
  await expect(pipeline(Readable.from([Buffer.alloc(4), Buffer.alloc(4)]), byteLimit(7, 'a.jpg'), over.stream)).rejects.toThrow(/a\.jpg: more than 7 bytes/)

  // A body that never ends: the pipeline fails and stops reading, it does not drain the source.
  let produced = 0
  const endless = Readable.from(
    (function* () {
      for (;;) {
        produced += 100
        yield Buffer.alloc(100)
      }
    })(),
  )
  await expect(pipeline(endless, byteLimit(1000, 'b.zip'), sink().stream)).rejects.toThrow(/b\.zip: more than 1000 bytes/)
  expect(produced).toBeLessThan(10_000)
})

test('readBody collects an API answer up to its limit', async () => {
  expect((await readBody(Readable.from([Buffer.from('{"a":'), Buffer.from('1}')]), 100, 'api')).toString()).toBe('{"a":1}')
  await expect(readBody(Readable.from([Buffer.alloc(60), Buffer.alloc(60)]), 100, 'api')).rejects.toThrow(/api: more than 100 bytes/)
})

/** A GLB holding only a JSON chunk. */
function makeGlb(json) {
  let text = JSON.stringify(json)
  while (Buffer.byteLength(text) % 4 !== 0) text += ' '
  const body = Buffer.from(text)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + body.length, 8)
  header.writeUInt32LE(body.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  return Buffer.concat([header, body])
}

test('glbExtensionsUsed reads the extensions a GLB really declares', () => {
  const asset = { version: '2.0' }
  expect(glbExtensionsUsed(makeGlb({ asset, extensionsUsed: ['EXT_texture_webp', 'KHR_materials_transmission'] }))).toEqual(['EXT_texture_webp', 'KHR_materials_transmission'])
  expect(glbExtensionsUsed(makeGlb({ asset }))).toEqual([])
  expect(() => glbExtensionsUsed(Buffer.from('this is not a glb file at all'))).toThrow(/Not a GLB/)
  expect(() => glbExtensionsUsed(makeGlb({ asset }).subarray(0, 24))).toThrow(/Corrupt GLB/)
})

test('auditAssetFiles compares the files on disk with the files the manifest produces', () => {
  const expected = ['models/a.glb', 'textures/b_color.webp']
  expect(auditAssetFiles(['models/a.glb', 'textures/b_color.webp'], expected)).toEqual({ unexpected: [], missing: [] })
  expect(auditAssetFiles(['models/a.glb', 'hdr/sky.hdr', 'notes.txt'], expected)).toEqual({ unexpected: ['hdr/sky.hdr', 'notes.txt'], missing: ['textures/b_color.webp'] })
})
