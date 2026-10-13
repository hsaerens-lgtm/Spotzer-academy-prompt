import { Mesh, OrthographicCamera, PMREMGenerator, WebGLRenderTarget, type BufferGeometry, type ShaderMaterial, type WebGLRenderer } from 'three'

/**
 * What precompilePmrem reads of three 0.186's PMREMGenerator: no public method reaches its GGX convolution material
 * (compileCubemapShader() only covers the cheap cube-to-cubeUV pass). pmrem.test.ts checks these members against the
 * installed three, and checks that the material and geometry are the ones its PMREM draws with.
 */
interface PmremInternals {
  _setSize(cubeSize: number): void
  _allocateTargets(): WebGLRenderTarget
  _ggxMaterial: ShaderMaterial | null
  _lodMeshes: Mesh<BufferGeometry>[]
}

/**
 * three builds the environment's PMREM (the blurred reflections every PBR material samples) the first time a material
 * needs it, inside the base compile, and links its GGX convolution program on the spot: on a cold ANGLE D3D11 GPU
 * process the main thread waits about 330 ms for it (Task 16b), before a single office program has been queued.
 * This compiles that program in parallel (KHR_parallel_shader_compile) as soon as the renderer exists, for a cube
 * environment of `cubeSize` pixels: same shaders, defines and vertex attributes, drawn into a render target as three
 * draws it (linear output, no tone mapping), so three's own PMREM finds it in the renderer's program cache.
 * The material is never disposed: that would release the program before three's PMREM takes it. Without parallel
 * compilation (SwiftShader, Safari) it does nothing: compiling would block here instead of there.
 */
export function precompilePmrem(gl: WebGLRenderer, cubeSize: number): Promise<unknown> {
  if (!gl.extensions.has('KHR_parallel_shader_compile')) return Promise.resolve()
  const pmrem = new PMREMGenerator(gl) as unknown as PmremInternals
  pmrem._setSize(cubeSize)
  // Builds the GGX material and the LOD planes. The render targets it also creates are never bound: no GPU memory.
  pmrem._allocateTargets()
  const mesh = new Mesh(pmrem._lodMeshes[0].geometry, pmrem._ggxMaterial!)
  const target = new WebGLRenderTarget(1, 1)
  const previous = gl.getRenderTarget()
  gl.setRenderTarget(target)
  try {
    return gl.compileAsync(mesh, new OrthographicCamera()).finally(() => target.dispose())
  } finally {
    gl.setRenderTarget(previous)
  }
}
