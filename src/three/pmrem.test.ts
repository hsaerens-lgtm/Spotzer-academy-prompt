import { Mesh, PMREMGenerator, WebGLCubeRenderTarget, type ShaderMaterial, type WebGLRenderTarget, type WebGLRenderer } from 'three'
import { precompilePmrem } from './pmrem'

/*
 * The environment's PMREM (the blurred reflections every PBR material samples) is built by three the first time a
 * material needs it, and its GGX convolution program is linked on the spot: about 330 ms of main thread on a cold
 * ANGLE D3D11 GPU process, inside the base compile (Task 16b). precompilePmrem compiles that very program in parallel
 * as soon as the renderer exists, so three's own PMREM finds it in the renderer's program cache.
 */

interface Draw {
  mesh: Mesh
  target: WebGLRenderTarget | null
}

/** A renderer stand-in (jsdom has no WebGL) that records what is compiled or drawn, with the render target bound then. */
function standIn(parallel = true) {
  let target: WebGLRenderTarget | null = null
  const compiled: Draw[] = []
  const drawn: Draw[] = []
  const gl = {
    extensions: { has: vi.fn((name: string) => parallel && name === 'KHR_parallel_shader_compile') },
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next
    },
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    xr: { enabled: false },
    autoClear: true,
    compileAsync: vi.fn((mesh: Mesh) => {
      compiled.push({ mesh, target })
      return Promise.resolve(mesh)
    }),
    render: (mesh: Mesh) => {
      drawn.push({ mesh, target })
    },
  }
  return { gl: gl as unknown as WebGLRenderer, compiled, drawn, bound: () => target }
}

const GGX = 'PMREMGGXConvolution'
const materialOf = (draw: Draw) => draw.mesh.material as ShaderMaterial
const attributes = (draw: Draw) => Object.keys(draw.mesh.geometry.attributes).sort()

test("the environment's GGX convolution is compiled ahead exactly as three's PMREM draws it", async () => {
  const resolution = 256
  // What three's own PMREM draws for a cube environment of this resolution (drei's <Environment> renders one).
  const reference = standIn()
  new PMREMGenerator(reference.gl).fromCubemap(new WebGLCubeRenderTarget(resolution).texture)
  const drawnGgx = reference.drawn.find((draw) => materialOf(draw).name === GGX)!
  expect(drawnGgx).toBeDefined()

  const { gl, compiled, bound } = standIn()
  await precompilePmrem(gl, resolution)
  expect(compiled).toHaveLength(1)
  const [ahead] = compiled
  // The same program: same shaders and defines (cube size), same vertex attributes...
  expect(materialOf(ahead).name).toBe(GGX)
  expect(materialOf(ahead).vertexShader).toBe(materialOf(drawnGgx).vertexShader)
  expect(materialOf(ahead).fragmentShader).toBe(materialOf(drawnGgx).fragmentShader)
  expect(materialOf(ahead).defines).toEqual(materialOf(drawnGgx).defines)
  expect(attributes(ahead)).toEqual(attributes(drawnGgx))
  // ...and, like three's draw, into a render target (linear output, no tone mapping), the caller's target restored.
  expect(drawnGgx.target).not.toBeNull()
  expect(ahead.target).not.toBeNull()
  expect(bound()).toBeNull()
})

// SwiftShader (the e2e browser) and Safari: compiling ahead would block the main thread, where three's PMREM blocks anyway.
test('without parallel shader compilation, nothing is compiled ahead', async () => {
  const { gl, compiled } = standIn(false)
  await precompilePmrem(gl, 256)
  expect(gl.extensions.has).toHaveBeenCalledWith('KHR_parallel_shader_compile')
  expect(compiled).toEqual([])
})
