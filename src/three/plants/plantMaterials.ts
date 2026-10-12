// Ported from Horn.os (owner's project): js/lib/plants.js (canopy and pot finishes), js/scene/models.js (glazes)
import { Color, DoubleSide, MeshStandardMaterial } from 'three'
import { ENV_MAP_INTENSITY } from '../materials'
import { noiseTexture, speckleTexture } from '../noise'
import { tints } from '../tints'
import type { HangingGlaze, PotGlaze } from './types'

/*
 * The few materials every plant shares: one canopy (leaf colours ride on the vertex colours), one per pot glaze and
 * hanging glaze, one for the macrame cords. Each has a colour map and a roughness map, so the material audit
 * counts them as textured. Built on first use (never at import: reading mode loads no 3D), never disposed.
 */

export interface PlantMaterials {
  canopy: MeshStandardMaterial
  pots: Record<Exclude<PotGlaze, 'none'>, MeshStandardMaterial>
  hangingPots: Record<HangingGlaze, MeshStandardMaterial>
  cord: MeshStandardMaterial
}

/** Horn.os finishes: matt terracotta, satin cream and slate, brushed brass. */
const POT_FINISH: Record<Exclude<PotGlaze, 'none'>, { roughness: number; metalness: number; envMapIntensity: number; seed: number }> = {
  terracotta: { roughness: 0.82, metalness: 0, envMapIntensity: 0.7, seed: 5 },
  cream: { roughness: 0.55, metalness: 0, envMapIntensity: 0.9, seed: 3 },
  slate: { roughness: 0.6, metalness: 0, envMapIntensity: 0.8, seed: 9 },
  brass: { roughness: 0.38, metalness: 0.7, envMapIntensity: 1.4, seed: 11 },
}
const HANGING_FINISH: Record<HangingGlaze, { roughness: number; seed: number }> = {
  white: { roughness: 0.55, seed: 3 },
  terracotta: { roughness: 0.9, seed: 5 },
  sage: { roughness: 0.6, seed: 7 },
  charcoal: { roughness: 0.7, seed: 9 },
}

/** Speckle colours of a glaze with no entry in tints.potDots: two darker shades and one lighter. */
function shades(base: string): string[] {
  const colour = new Color(base)
  const lighter = colour.clone().lerp(new Color(1, 1, 1), 0.3)
  return [colour.clone().multiplyScalar(0.55), lighter, colour.clone().multiplyScalar(0.35)].map((c) => `#${c.getHexString()}`)
}

let shared: PlantMaterials | null = null

export function plantMaterials(): PlantMaterials {
  if (shared) return shared
  const pots = {} as PlantMaterials['pots']
  for (const glaze of Object.keys(POT_FINISH) as (keyof typeof POT_FINISH)[]) {
    const { seed, ...finish } = POT_FINISH[glaze]
    pots[glaze] = new MeshStandardMaterial({
      name: `pot-${glaze}`,
      map: speckleTexture({ base: tints.potGlazes[glaze], dots: tints.potDots[glaze], seed }),
      roughnessMap: noiseTexture(),
      ...finish,
    })
  }
  const hangingDots: Record<HangingGlaze, readonly string[]> = {
    white: tints.potDots.cream,
    terracotta: tints.potDots.terracotta,
    sage: shades(tints.hangingGlazes.sage),
    charcoal: tints.potDots.slate,
  }
  const hangingPots = {} as PlantMaterials['hangingPots']
  for (const glaze of Object.keys(HANGING_FINISH) as HangingGlaze[]) {
    const { roughness, seed } = HANGING_FINISH[glaze]
    hangingPots[glaze] = new MeshStandardMaterial({
      name: `hanging-${glaze}`,
      map: speckleTexture({ base: tints.hangingGlazes[glaze], dots: hangingDots[glaze], seed }),
      roughnessMap: noiseTexture(),
      roughness,
      envMapIntensity: ENV_MAP_INTENSITY.model,
    })
  }
  shared = {
    // Leaves are thin enough to be lit from behind: double-sided, one material for every canopy in the room.
    canopy: new MeshStandardMaterial({
      name: 'canopy',
      vertexColors: true,
      side: DoubleSide,
      roughness: 0.68,
      envMapIntensity: ENV_MAP_INTENSITY.plant,
      map: noiseTexture({ size: 64, min: 0.8, max: 1, seed: 13, repeat: 10, srgb: true }),
      roughnessMap: noiseTexture({ seed: 19, repeat: 10 }),
    }),
    pots,
    hangingPots,
    cord: new MeshStandardMaterial({
      name: 'cord',
      color: tints.cord,
      map: noiseTexture({ srgb: true }),
      roughness: 0.95,
      roughnessMap: noiseTexture(),
    }),
  }
  return shared
}
