import { Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three'
import { paintPending } from '../../../three/paintLater'
import { canvasTexture } from './resources'

/*
 * The outdoor's painted canvases wait for the base's programs to be queued before they are painted (Task 16b): the
 * texture exists at once, with its size, colour space and repeat, and its canvas is painted by paintPending().
 */

// jsdom has no 2D canvas: a stand-in context, so no test calls the real getContext.
const context = { stand: 'in' } as unknown as CanvasRenderingContext2D

afterEach(() => {
  vi.restoreAllMocks()
})

test('a painted canvas texture is set up at once, and painted only when the stage paints what it holds', () => {
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
  const draw = vi.fn()
  const texture = canvasTexture(64, 32, draw, { repeat: [3, 4] })
  expect(texture.image).toMatchObject({ width: 64, height: 32 })
  expect(texture.colorSpace).toBe(SRGBColorSpace)
  expect([texture.wrapS, texture.wrapT]).toEqual([RepeatWrapping, RepeatWrapping])
  expect(texture.repeat.toArray()).toEqual([3, 4])
  expect(texture.anisotropy).toBe(8)
  expect(draw).not.toHaveBeenCalled()
  expect(getContext).not.toHaveBeenCalled()

  paintPending(new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ map: texture })))
  expect(getContext).toHaveBeenCalledWith('2d')
  expect(draw).toHaveBeenCalledTimes(1)
  expect(draw).toHaveBeenCalledWith(context, 64, 32)
})

test('a canvas without a 2D context fails when it is painted', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const texture = canvasTexture(8, 8, () => {})
  expect(() => paintPending(new Mesh(new PlaneGeometry(), new MeshBasicMaterial({ map: texture })))).toThrow('canvasTexture: no 2D canvas context')
})
