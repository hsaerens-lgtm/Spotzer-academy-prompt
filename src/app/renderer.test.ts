import { WebGLRenderer } from 'three'
import { precompilePmrem } from '../three/pmrem'
import { RIG } from '../zones/office/lighting/rig'
import { createRenderer } from './renderer'

/*
 * The office's renderer, as <Canvas> would build it from its defaults, with the environment's PMREM program compiling
 * from the moment the renderer exists (pmrem.ts): before the first render, so it is ready when the base compiles.
 */

// jsdom has no WebGL: a stand-in renderer that keeps its parameters.
vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: vi.fn(function (this: { parameters: unknown }, parameters: unknown) {
    this.parameters = parameters
  }),
}))
vi.mock('../three/pmrem', () => ({ precompilePmrem: vi.fn(() => Promise.resolve()) }))

afterEach(() => {
  vi.clearAllMocks()
})

const defaults = { canvas: document.createElement('canvas'), powerPreference: 'high-performance', antialias: true, alpha: true } as const

test('the renderer keeps the canvas defaults, antialiased on the high-performance GPU', () => {
  const renderer = createRenderer({ ...defaults, antialias: false, powerPreference: 'default' })
  expect(WebGLRenderer).toHaveBeenCalledTimes(1)
  expect((renderer as unknown as { parameters: unknown }).parameters).toEqual({ ...defaults, antialias: true, powerPreference: 'high-performance' })
})

test("the environment's PMREM starts compiling with the renderer, at the environment's resolution", () => {
  const renderer = createRenderer(defaults)
  expect(precompilePmrem).toHaveBeenCalledWith(renderer, RIG.environment.resolution)
})

test('a failed warm-up still gives the office its renderer', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.mocked(precompilePmrem).mockImplementationOnce(() => {
    throw new Error('context lost')
  })
  expect(createRenderer(defaults)).toBeInstanceOf(WebGLRenderer)
  vi.mocked(precompilePmrem).mockImplementationOnce(() => Promise.reject(new Error('context lost')))
  expect(createRenderer(defaults)).toBeInstanceOf(WebGLRenderer)
  await Promise.resolve()
  // Development only: three's PMREM compiles the program anyway when the base needs it.
  expect(warn).toHaveBeenCalledTimes(2)
  warn.mockRestore()
})
