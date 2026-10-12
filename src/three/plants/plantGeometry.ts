// Ported from Horn.os (owner's project): js/lib/plants.js
import { CircleGeometry, Color, CylinderGeometry, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'
import { at, mergeParts, type Part } from '../merge'
import { tints } from '../tints'
import { leafGeometry } from './leaf'
import type { PlantKind, PotGlaze } from './types'

/*
 * Houseplants as geometry. Every plant bakes its whole canopy (leaves, stems and the soil disc) into one geometry
 * whose leaf colours ride on a vertex attribute, and its pot (body and rim) into another: two meshes per plant,
 * whatever grows in it. Horn.os' LCG makes each plant the same on every run.
 *
 * Four heights differ from Horn.os so that every plant stays inside its footprint (zones/office/footprints.ts), which
 * the layout tests use to keep the laptop and the retro corner clear: monstera petioles rise 0.2-0.4 (Horn 0.34-0.7),
 * palm canes stand 0.45 x k (Horn 0.8 x k) with fronds curled 0.5 (Horn 0.9), pothos vines drop 0.35-0.6
 * (Horn 0.4-0.9), herb stems rise 0.04-0.12 with leaves of 0.03-0.06 (Horn 0.04-0.14 and 0.035-0.065). All x scale.
 */

export interface PlantGeometry {
  /** Pot body and rim, with UVs around the pot; null for a potless plant (one standing in a vase). */
  pot: BufferGeometry | null
  /** Leaves, stems and soil in one geometry, with a 'color' attribute and UVs (leaves: outline in metres). */
  canopy: BufferGeometry
}
export interface PlantOptions {
  /** Pot radius and height, in metres. */
  r: number
  h: number
  pot: PotGlaze
  /** Multiplies the size of the foliage (not of the pot). */
  scale: number
  seed: number
  /** Pothos only: direction (radians about +y, 0 = +z) the vines spill toward; random directions when omitted. */
  fall?: number
  /**
   * Pothos with a `fall` only, for one that stands near the edge of its bench or board: how far from the pot's axis, in
   * metres (not scaled), the vines travel along `fall` before they hang. They get there within the first third of their
   * length, fanned narrower, so they hang past the edge instead of through it. Other plants ignore it; vines without it
   * spill 6 to 13 cm x scale and fall.
   */
  reach?: number
}

/** Horn.os' LCG: numbers in [0, 1), the same sequence for the same seed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const UP = new Vector3(0, 1, 0)
const cache = new Map<string, PlantGeometry>()

/** One plant standing on the origin (bottom of the pot). Cached by its arguments, never disposed: placements share it. */
export function plantGeometry(kind: PlantKind, options: PlantOptions): PlantGeometry {
  const { r, h, pot, scale, seed, fall, reach } = options
  const key = JSON.stringify([kind, r, h, pot, scale, seed, fall ?? null, reach ?? null])
  const cached = cache.get(key)
  if (cached) return cached
  const built = buildPlant(kind, r, h, pot, scale, seed, fall ?? null, reach ?? null)
  cache.set(key, built)
  return built
}

/** With a reach, the share of its length a vine takes to travel it, and how wide the vines fan about `fall` (radians). */
const REACH_BY = 0.3
const REACH_FAN = 1.2

function buildPlant(
  kind: PlantKind,
  r: number,
  h: number,
  pot: PotGlaze,
  scale: number,
  seed: number,
  fall: number | null,
  vineReach: number | null,
): PlantGeometry {
  const rand = seeded(seed)
  const greens = tints.leafGreens.map((colour) => new Color(colour))
  const stem = new Color(tints.stem)
  const pick = () => greens[Math.floor(rand() * greens.length)]
  const parts: Part[] = []

  // The pot: body and rim share a material, so they merge; the soil rides in the canopy with a brown vertex colour.
  let potGeometry: BufferGeometry | null = null
  if (pot !== 'none') {
    const body = new CylinderGeometry(r, r * 0.76, h, 18)
    const rim = new CylinderGeometry(r * 1.07, r * 1.07, h * 0.12, 18)
    potGeometry = mergeParts([
      { geometry: body, matrix: at(0, h / 2, 0) },
      { geometry: rim, matrix: at(0, h * 0.94, 0) },
    ])
    body.dispose()
    rim.dispose()
    parts.push({ geometry: new CircleGeometry(r * 0.95, 18).rotateX(-Math.PI / 2), matrix: at(0, h * 0.97, 0), colour: new Color(tints.soil) })
  }
  const base = pot === 'none' ? 0 : h * 0.96

  // A stem is a part, not a mesh: it merges with the canopy.
  const stemPart = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, radius: number) => {
    const a = new Vector3(x0, y0, z0)
    const dir = new Vector3(x1, y1, z1).sub(a)
    const length = dir.length()
    if (length < 1e-4) return
    const matrix = new Matrix4().compose(a.clone().addScaledVector(dir, 0.5), new Quaternion().setFromUnitVectors(UP, dir.normalize()), new Vector3(1, 1, 1))
    parts.push({ geometry: new CylinderGeometry(radius * 0.7, radius, length, 5), matrix, colour: stem })
  }
  // One leaf, grown along +y, pitched away from vertical by `tilt` and swung round the stem by `yaw`.
  const leafPart = (geometry: BufferGeometry, x: number, y: number, z: number, yaw: number, tilt: number, roll = 0) => {
    const matrix = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(tilt, yaw, roll, 'YXZ')), new Vector3(1, 1, 1))
    parts.push({ geometry, matrix, colour: pick() })
  }

  if (kind === 'monstera') {
    // Big, few, each leaf on its own long petiole reaching out of the pot at its own angle.
    const n = 8
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rand() * 0.5
      const reach = (0.2 + rand() * 0.24) * scale
      const rise = (0.2 + rand() * 0.2) * scale
      const ex = Math.sin(yaw) * reach
      const ez = Math.cos(yaw) * reach
      stemPart(0, base, 0, ex, base + rise, ez, 0.009 * scale)
      const length = (0.26 + rand() * 0.1) * scale
      leafPart(leafGeometry({ kind: 'heart', len: length, wid: length * 0.92, split: true, steps: 44, droop: 0.5, fold: 0.22 }), ex, base + rise, ez, yaw + Math.PI, 1.15 + rand() * 0.35)
    }
  } else if (kind === 'palm') {
    // Three canes of different heights with a crown each: one cane reads as a lamp post with leaves.
    const canes = [1, 0.72, 0.48]
    canes.forEach((k, ci) => {
      const lean = (rand() - 0.5) * 0.12
      const top = base + 0.45 * k * scale
      const tx = lean * 0.7
      stemPart(ci * 0.03 - 0.03, base, ci * 0.02 - 0.02, tx, top, 0, 0.026 * scale * k)
      for (let i = 0; i < 8; i++) {
        const yaw = (i / 8) * Math.PI * 2 + ci * 0.7
        const length = (0.38 + rand() * 0.16) * scale * Math.max(0.7, k)
        leafPart(leafGeometry({ kind: 'blade', len: length, wid: length * 0.24, steps: 16, droop: 0.5, fold: 0.5 }), tx, top, 0, yaw, 0.95 + rand() * 0.6)
      }
    })
  } else if (kind === 'fern') {
    // Fronds: a spine with paired leaflets, the whole frond arching over.
    for (let f = 0; f < 9; f++) {
      const yaw = (f / 9) * Math.PI * 2 + rand() * 0.4
      const length = (0.3 + rand() * 0.12) * scale
      const tilt = 0.75 + rand() * 0.5
      const dir = new Vector3(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt))
      const segments = 7
      let previous = new Vector3(0, base, 0)
      for (let k = 1; k <= segments; k++) {
        const t = k / segments
        const p = new Vector3(0, base, 0).addScaledVector(dir, length * t)
        p.y -= 0.55 * length * t * t // the arch
        stemPart(previous.x, previous.y, previous.z, p.x, p.y, p.z, 0.004 * scale)
        for (const side of [-1, 1]) {
          const leaflet = length * 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.006
          leafPart(leafGeometry({ kind: 'oval', len: leaflet, wid: leaflet * 0.42, steps: 9, droop: 0.3, fold: 0.3 }), p.x, p.y, p.z, yaw + side * 1.5, 1.5)
        }
        previous = p
      }
    }
  } else if (kind === 'pothos') {
    // The trailing one: a small crown, then vines that spill over the edge of whatever it stands on.
    for (let i = 0; i < 5; i++) {
      const yaw = (i / 5) * Math.PI * 2 + rand()
      const length = (0.07 + rand() * 0.04) * scale
      const x = Math.sin(yaw) * length * 0.5
      const z = Math.cos(yaw) * length * 0.5
      stemPart(0, base, 0, x, base + length * 0.7, z, 0.005 * scale)
      leafPart(leafGeometry({ kind: 'heart', len: length, wid: length * 0.8, steps: 16, droop: 0.4, fold: 0.3 }), x, base + length * 0.7, z, yaw + Math.PI, 1.0 + rand() * 0.4)
    }
    const vines = 3 + Math.floor(rand() * 2)
    for (let v = 0; v < vines; v++) {
      // `fall` aims them: loose vines on a shelf hang straight through the shelf behind them.
      const reaching = fall !== null && vineReach !== null
      const yaw = fall === null ? rand() * Math.PI * 2 : fall + (rand() - 0.5) * (reaching ? REACH_FAN : 1.7)
      const drop = (0.35 + rand() * 0.25) * scale
      // With a reach, every vine gets as far along `fall` as asked, whichever way it fans.
      const out = reaching ? vineReach / Math.cos(yaw - fall) : (0.06 + rand() * 0.07) * scale
      if (reaching) rand() // the draw it replaces: every later draw stays what it is without a reach
      let previous = new Vector3(0, base, 0)
      for (let k = 1; k <= 9; k++) {
        const t = k / 9
        // Out fast, then straight down: gravity takes over within a hand's width (with a reach: within a third of the vine).
        const travel = reaching ? Math.pow(Math.min(1, t / REACH_BY), 0.5) : Math.pow(t, 0.4)
        const p = new Vector3(
          Math.sin(yaw) * out * travel + Math.sin(t * 7 + v) * 0.012 * scale,
          base - drop * t * t,
          Math.cos(yaw) * out * travel + Math.cos(t * 6 + v) * 0.012 * scale,
        )
        stemPart(previous.x, previous.y, previous.z, p.x, p.y, p.z, 0.0035 * scale)
        const leaf = (0.035 + rand() * 0.022) * scale
        leafPart(leafGeometry({ kind: 'heart', len: leaf, wid: leaf * 0.82, steps: 12, droop: 0.4, fold: 0.28 }), p.x, p.y, p.z, rand() * Math.PI * 2, 1.9 + rand() * 0.8)
        previous = p
      }
    }
  } else if (kind === 'succulent') {
    // Three tiers of fat little paddles, each turned off the one below.
    const tiers = [
      { n: 5, radius: 0.055, tilt: 1.35, length: 0.062 },
      { n: 5, radius: 0.034, tilt: 1.0, length: 0.05 },
      { n: 4, radius: 0.016, tilt: 0.55, length: 0.035 },
    ]
    tiers.forEach((tier, ti) => {
      for (let i = 0; i < tier.n; i++) {
        const yaw = (i / tier.n) * Math.PI * 2 + ti * 0.6
        const length = tier.length * scale
        leafPart(
          leafGeometry({ kind: 'round', len: length, wid: length * 0.66, steps: 11, droop: 0.2, fold: 0.5 }),
          Math.sin(yaw) * tier.radius * scale,
          base + ti * 0.012 * scale,
          Math.cos(yaw) * tier.radius * scale,
          yaw + Math.PI,
          tier.tilt,
        )
      }
    })
  } else {
    // 'herb': the bushy catch-all for a shelf.
    for (let i = 0; i < 26; i++) {
      const yaw = rand() * Math.PI * 2
      const up = (0.04 + rand() * 0.08) * scale
      const out = (0.02 + rand() * 0.06) * scale
      const x = Math.sin(yaw) * out
      const z = Math.cos(yaw) * out
      stemPart(0, base, 0, x, base + up, z, 0.004 * scale)
      const length = (0.03 + rand() * 0.03) * scale
      leafPart(leafGeometry({ kind: 'oval', len: length, wid: length * 0.55, steps: 10, droop: 0.35, fold: 0.3 }), x, base + up, z, yaw + Math.PI, 0.9 + rand() * 0.9)
    }
  }

  const canopy = mergeParts(parts, { colours: true })
  for (const part of parts) part.geometry.dispose()
  return { pot: potGeometry, canopy }
}
