// Ported from Horn.os (owner's project): js/lib/merge.js
import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/*
 * Merging small static pieces into single meshes. A shelf of books built as seventy meshes is seventy draw calls and
 * seventy entries in the shadow pass; baked into one geometry it is one of each, and the pieces keep their own colours
 * through a vertex-colour attribute. Only merge pieces that never move relative to each other.
 */

const KEEP = ['position', 'normal', 'uv']

export interface Part {
  geometry: BufferGeometry
  matrix?: Matrix4
  colour?: Color
}

/**
 * Bakes parts into one non-indexed BufferGeometry with position, normal and uv (zero UVs where a part has none),
 * each part moved by its matrix; with `colours`, a 'color' attribute holds each part's colour (white by default).
 * Inputs are cloned, never touched: several of them come from shared caches.
 * The result is for one material: groups and material indices are dropped. It is meant for geometry built in code;
 * parts from a GLB with interleaved or quantized attributes are not supported.
 */
export function mergeParts(parts: readonly Part[], options: { colours?: boolean } = {}): BufferGeometry {
  if (parts.length === 0) throw new Error('mergeParts needs at least one part')
  const white = new Color(1, 1, 1)
  const prepared = parts.map(({ geometry, matrix, colour }) => {
    // mergeGeometries refuses a mix of indexed and non-indexed inputs: going non-indexed everywhere always works.
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
    g.morphAttributes = {}
    const count = g.getAttribute('position').count
    if (!g.hasAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2))
    if (!g.hasAttribute('normal')) g.computeVertexNormals()
    if (matrix) g.applyMatrix4(matrix)
    if (options.colours) {
      const c = colour ?? white
      const values = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) values.set([c.r, c.g, c.b], i * 3)
      g.setAttribute('color', new BufferAttribute(values, 3))
    }
    return g
  })
  const merged = mergeGeometries(prepared, false)
  for (const g of prepared) g.dispose()
  if (!merged) throw new Error('mergeParts: the parts could not be merged')
  return merged
}

/** The transform of one part, as a matrix: position, Euler rotation (radians) and uniform scale. */
export function at(x: number, y: number, z: number, rotation: [number, number, number] = [0, 0, 0], scale = 1): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2])),
    new Vector3(scale, scale, scale),
  )
}
