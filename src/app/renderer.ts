import { WebGLRenderer, type WebGLRendererParameters } from 'three'
import { precompilePmrem } from '../three/pmrem'
import { RIG } from '../zones/office/lighting/rig'

/**
 * The office's renderer, for <Canvas gl>: the canvas defaults, antialiased, on the high-performance GPU. The
 * environment's PMREM program starts compiling the moment the renderer exists, before the first render, so it is
 * ready when the base compiles (pmrem.ts, Task 16b). A failed warm-up changes nothing: three's PMREM compiles the
 * program itself when the base needs it.
 */
export function createRenderer(defaults: WebGLRendererParameters): WebGLRenderer {
  const renderer = new WebGLRenderer({ ...defaults, antialias: true, powerPreference: 'high-performance' })
  const warned = (error: unknown) => {
    if (import.meta.env.DEV) console.warn('The environment PMREM did not compile ahead of time.', error)
  }
  try {
    precompilePmrem(renderer, RIG.environment.resolution).catch(warned)
  } catch (error) {
    warned(error)
  }
  return renderer
}
