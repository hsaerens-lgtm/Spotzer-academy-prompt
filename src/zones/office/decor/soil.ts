import { BufferAttribute, BufferGeometry, Color } from 'three'
import { lcg } from '../../../three/noise'

/*
 * The potting soil of the money tree's planter, which comes empty: a skin, not a disc. Its edge goes into the clay wall
 * (the planter is out of round by about 5 mm, so a disc that only just fits would show a crack of clay somewhere), it
 * rises to a low dome under the trunk, is uneven by a millimetre or two, and dips a little near the wall.
 * Heights are measured from the soil line.
 */

export interface SoilShape {
  /** Radius of the skin's edge, in metres. */
  radius: number
  /** Height of the middle above the soil line. */
  dome: number
  /** Amplitude of the unevenness. */
  bump: number
  /** How far the skin dips under the soil line at the wall. */
  drop: number
  /** Seed of the unevenness (Horn.os' LCG). */
  seed: number
}

const RINGS = 12
const SEGMENTS = 72

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Five plane waves of 3 to 8 cm across the skin, in [-1, 1] together: an uneven surface, not a pattern. */
function unevenness(seed: number): (x: number, z: number) => number {
  const random = lcg(seed)
  const waves = Array.from({ length: 5 }, () => {
    const direction = random() * Math.PI * 2
    const frequency = (Math.PI * 2) / (0.03 + random() * 0.05)
    return { kx: Math.cos(direction) * frequency, kz: Math.sin(direction) * frequency, phase: random() * Math.PI * 2 }
  })
  return (x, z) => waves.reduce((sum, wave) => sum + Math.sin(wave.kx * x + wave.kz * z + wave.phase), 0) / waves.length
}

/**
 * The skin as a polar grid (a centre and 12 rings of 72 points), facing up, centred on the origin with y = 0 the soil
 * line, its UVs a planar projection (0.5 at the centre, 0 and 1 at the edge's extremes).
 */
export function soilGeometry({ radius, dome, bump, drop, seed }: SoilShape): BufferGeometry {
  const uneven = unevenness(seed)
  const height = (x: number, z: number) => {
    const rho = Math.hypot(x, z) / radius
    return dome * (1 - rho * rho) + bump * uneven(x, z) - drop * smoothstep(0.8, 1, rho)
  }
  const count = 1 + RINGS * SEGMENTS
  const positions = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  positions.set([0, height(0, 0), 0], 0)
  uvs.set([0.5, 0.5], 0)
  const at = (ring: number, segment: number) => 1 + (ring - 1) * SEGMENTS + (segment % SEGMENTS)
  for (let ring = 1; ring <= RINGS; ring++) {
    const r = (radius * ring) / RINGS
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const angle = (segment / SEGMENTS) * Math.PI * 2
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const i = at(ring, segment)
      positions.set([x, height(x, z), z], i * 3)
      uvs.set([0.5 + x / (2 * radius), 0.5 + z / (2 * radius)], i * 2)
    }
  }
  const indices: number[] = []
  for (let segment = 0; segment < SEGMENTS; segment++) indices.push(0, at(1, segment + 1), at(1, segment))
  for (let ring = 1; ring < RINGS; ring++) {
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const a = at(ring, segment)
      const b = at(ring, segment + 1)
      const c = at(ring + 1, segment)
      const d = at(ring + 1, segment + 1)
      indices.push(a, b, c, b, d, c)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * The colours of the soil's speckle, as CSS hex, derived from the soil tint: the tint itself is nearly black, which in the
 * shade of the corner reads as black, so the base is a warm dark brown a little over twice as bright, with a darker
 * speck, a lighter one and a sandy one.
 */
export function soilSpeckle(soil: string): { base: string; dots: string[] } {
  const brightness = (factor: number) => `#${new Color(soil).multiplyScalar(factor).getHexString()}`
  return { base: brightness(2.4), dots: [brightness(0.8), brightness(5), brightness(9)] }
}
