import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { brand } from '../../core/brand'
import { MODEL_PARTS } from '../assets'
import { fitLaptopScreen, laptopOutlined, paintWorkshopPreview, screenUVs } from './laptopModel'

/** A flat rectangle without UVs, like the model's screen glass: x from -2 to 2, y from 1 to 4, at z = -0.5. */
function glass(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-2, 1, -0.5, 2, 1, -0.5, 2, 4, -0.5, -2, 4, -0.5]), 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return geometry
}

const named = (name: string) => new MeshStandardMaterial({ name })

test('screen UVs span the glass, left to right and bottom to top, on a copy', () => {
  const source = glass()
  const fitted = screenUVs(source)
  expect(fitted).not.toBe(source)
  expect(source.getAttribute('uv')).toBeUndefined()
  const uv = fitted.getAttribute('uv')
  expect(Array.from(uv.array)).toEqual([0, 0, 1, 0, 1, 1, 0, 1])
})

test('the hover outline skips the screen glass', () => {
  expect(laptopOutlined(new Mesh(glass(), named(MODEL_PARTS.laptopScreen)))).toBe(false)
  expect(laptopOutlined(new Mesh(glass(), named('classic_laptop')))).toBe(true)
})

test('fitting the screen swaps its material and geometry, and leaves the body alone', () => {
  const body = new Mesh(glass(), named('classic_laptop'))
  const screenGeometry = glass()
  const screen = new Mesh(screenGeometry, named(MODEL_PARTS.laptopScreen))
  const root = new Group().add(body, new Group().add(screen))
  const preview = new MeshBasicMaterial()
  const bodyMaterial = body.material
  expect(fitLaptopScreen(root, preview)).toBe(screen)
  expect(screen.material).toBe(preview)
  expect(screen.geometry).not.toBe(screenGeometry)
  expect(screen.geometry.getAttribute('uv')).toBeDefined()
  expect(body.material).toBe(bodyMaterial)
  expect(fitLaptopScreen(new Group().add(new Mesh(glass(), named('other'))), preview)).toBeNull()
})

/** A 2D context that records every call and every style set. */
function recordingContext() {
  const calls: { name: string; args: unknown[]; fill: unknown }[] = []
  let fill: unknown = null
  const context = new Proxy({} as Record<string, unknown>, {
    get: (_, name: string) => (name === 'fillStyle' ? fill : (...args: unknown[]) => calls.push({ name, args, fill })),
    set: (_, name: string, value) => {
      if (name === 'fillStyle') fill = value
      return true
    },
  })
  return { context: context as unknown as CanvasRenderingContext2D, calls }
}

test('the workshop preview is the retro desktop in brand colours, with no text', () => {
  const { context, calls } = recordingContext()
  paintWorkshopPreview(context, 480, 392)
  expect(calls.some(({ name }) => /text|font/i.test(name))).toBe(false)
  // The desktop first covers the whole screen in ink.
  expect(calls[0]).toEqual({ name: 'fillRect', args: [0, 0, 480, 392], fill: brand.ink })
  // A lime title bar (the primary window) and a taskbar along the bottom edge.
  expect(calls.some(({ name, fill }) => name === 'fillRect' && fill === brand.lime)).toBe(true)
  expect(calls.some(({ name, args }) => name === 'fillRect' && (args[1] as number) + (args[3] as number) === 392 && args[2] === 480)).toBe(true)
})
