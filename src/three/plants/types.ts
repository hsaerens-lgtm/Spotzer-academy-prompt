/*
 * Placement types of the plants, vases and shelf books (src/zones/office/layout.ts). Types only, no import:
 * the plant generators (Task 13) and the layout share them without depending on each other.
 */
type Vec3 = [number, number, number]

export type PlantKind = 'monstera' | 'palm' | 'fern' | 'pothos' | 'succulent' | 'herb'
export type PotGlaze = 'terracotta' | 'cream' | 'slate' | 'brass' | 'none'
export type HangingGlaze = 'white' | 'terracotta' | 'sage' | 'charcoal'

/** A plant in its pot. position: bottom centre of the pot; r, h: pot radius and height; sway: amplitude in radians (0 = still); fall: direction of trailing vines (radians about y). */
export interface PlantPlacement {
  kind: PlantKind
  position: Vec3
  pot: PotGlaze
  r: number
  h: number
  scale: number
  seed: number
  sway: number
  fall?: number
}

/** A plant hanging from the ceiling. position: the hook; vines and length in metres; drop: cord length below the hook. */
export interface HangingPlacement {
  position: Vec3
  seed: number
  glaze: HangingGlaze
  vines: number
  length: number
  drop: number
}

/** A plant growing out of a vase: no pot of its own. */
export type VasePlant = Omit<PlantPlacement, 'position' | 'pot'>

export interface VasePlacement {
  model: 'vaseTall' | 'vaseRound'
  position: Vec3
  rotationY?: number
  plant: VasePlant
}

/** A row of books standing on a shelf board between x0 and x1, at height y, depth centred on z. */
export interface ShelfBooksSpec {
  x0: number
  x1: number
  y: number
  z: number
  seed: number
}
