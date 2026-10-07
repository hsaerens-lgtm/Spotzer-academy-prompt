// @vitest-environment node
import { deflateRawSync } from 'node:zlib'
import { expect, test } from 'vitest'
import {
  ambientCgDownload,
  formatMiB,
  polyHavenModelDownloads,
  polyHavenTextureDownloads,
  readZip,
  renderCredits,
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
