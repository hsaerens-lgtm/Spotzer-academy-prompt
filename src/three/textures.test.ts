import { NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from 'three'
import { TEXTURE_SET_IDS, textureUrl } from './assets'
import { MAX_ANISOTROPY, configureTexture, textureSetUrls } from './textures'

test('colour maps are sRGB, data maps are linear', () => {
  expect(configureTexture(new Texture(), 'color', 1, 8).colorSpace).toBe(SRGBColorSpace)
  expect(configureTexture(new Texture(), 'normal', 1, 8).colorSpace).toBe(NoColorSpace)
  expect(configureTexture(new Texture(), 'arm', 1, 8).colorSpace).toBe(NoColorSpace)
})

test('textures repeat once per tile in metres', () => {
  const texture = configureTexture(new Texture(), 'color', 2, MAX_ANISOTROPY)
  expect(texture.wrapS).toBe(RepeatWrapping)
  expect(texture.wrapT).toBe(RepeatWrapping)
  expect(texture.repeat.toArray()).toEqual([0.5, 0.5])
  expect(texture.anisotropy).toBe(8)
  expect(configureTexture(new Texture(), 'normal', 0.5, 4).repeat.toArray()).toEqual([2, 2])
})

test('configuring twice changes nothing', () => {
  const texture = new Texture()
  configureTexture(texture, 'color', 2, 8)
  expect(texture.version).toBe(1)
  expect(configureTexture(texture, 'normal', 5, 2)).toBe(texture)
  expect(texture.version).toBe(1)
  expect(texture.colorSpace).toBe(SRGBColorSpace)
  expect(texture.repeat.toArray()).toEqual([0.5, 0.5])
  expect(texture.anisotropy).toBe(8)
})

test('texture URLs list colour, normal and ARM for every set', () => {
  const urls = textureSetUrls()
  expect(urls).toHaveLength(TEXTURE_SET_IDS.length * 3)
  expect(new Set(urls).size).toBe(urls.length)
  TEXTURE_SET_IDS.forEach((id, index) => {
    expect(urls.slice(index * 3, index * 3 + 3)).toEqual([textureUrl(id, 'color'), textureUrl(id, 'normal'), textureUrl(id, 'arm')])
  })
  expect(urls[0]).toMatch(/assets\/textures\/plank_flooring_04_color\.webp$/)
})
