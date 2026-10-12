import type { Camera, Object3D, Scene, WebGLRenderer } from 'three'

/**
 * Compiles every program `object` needs, against the lights and environment of `scene` (default: `object` itself), before
 * it is drawn. compileAsync where the browser compiles in parallel (KHR_parallel_shader_compile). Elsewhere (SwiftShader
 * in the e2e browser, Safari) compileAsync compiles at once anyway, after three warns on the console that the extension
 * is missing: compile() does the same work without the warning. Both loading stages use it (SceneReadySignal for the
 * base, DecorStage for the decor).
 */
export function compileAhead(gl: WebGLRenderer, object: Object3D, camera: Camera, scene: Scene | null = null): Promise<unknown> {
  if (gl.extensions.has('KHR_parallel_shader_compile')) return gl.compileAsync(object, camera, scene)
  gl.compile(object, camera, scene)
  return Promise.resolve()
}
