// Ported from Horn.os (owner's project): js/lib/shapes.js (boxProjectUVs)
import { BufferAttribute, type BufferGeometry } from 'three'

/**
 * UVs in metres by box projection: each vertex takes the two axes its normal is least aligned with, so a face never
 * samples the texture edge-on, and one UV unit is one metre (textures repeat per TEXTURE_SETS[...].tileMetres).
 * `offset` shifts the result (to break repeats between neighbours), `swap` turns it a quarter (wood grain direction).
 * Rewrites the `uv` attribute and returns the same geometry.
 */
export function metreUVs<T extends BufferGeometry>(geometry: T, options: { offset?: [number, number]; swap?: boolean } = {}): T {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (!position || !normal) throw new Error('metreUVs needs a geometry with positions and normals')
  const [du, dv] = options.offset ?? [0, 0]
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    let u: number
    let v: number
    if (nx >= ny && nx >= nz) {
      u = position.getZ(i)
      v = position.getY(i)
    } else if (ny >= nz) {
      u = position.getX(i)
      v = position.getZ(i)
    } else {
      u = position.getX(i)
      v = position.getY(i)
    }
    if (options.swap) [u, v] = [v, u]
    uv[i * 2] = u + du
    uv[i * 2 + 1] = v + dv
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  return geometry
}
