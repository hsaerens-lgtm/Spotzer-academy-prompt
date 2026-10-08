// Ported from Horn.os (owner's project): js/scene/city.js
/*
 * The plan of the city seen through the glazing: the office is on the eighth floor of a building on a tree-lined
 * street, with a park across it and the city beyond. Where the buildings stand, how tall, in which style, with their
 * rooftop plant and the beacons of the towers. Pure (no three.js): the same seed gives the same city on every run.
 */

/** Horn.os coordinates (its window wall is x = -2.3); the outdoor group is moved by originX so that wall lands on ours (x = -5). */
export const OUTDOOR = {
  originX: -2.7,
  groundY: -24, // the office is on the eighth floor
  streetX: -13, // centre line of the street, parallel to the facade
  park: { x0: -19, x1: -62 }, // a park across the street, then the city
  domeRadius: 400,
  fogNear: 60,
  fogFar: 420,
  cloudWrap: 280,
} as const

export const CITY_STYLES = { brick: 0, glass: 1, concrete: 2, plaster: 3 } as const

/** Centre x, z; w = extent along x, d = extent along z (Horn add(x, z, w, d, h)); tone in 0..1 picks a colour of the style. */
export interface BuildingSpec {
  x: number
  z: number
  w: number
  d: number
  h: number
  style: 0 | 1 | 2 | 3
  tone: number
}

/** A box standing on a roof: position of its base centre and its size. */
export interface RoofItem {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
}

export interface CityLayout {
  buildings: BuildingSpec[]
  units: RoofItem[]
  tanks: RoofItem[]
  /** Aircraft warning lights, one on top of each building taller than 55 m; phase in radians. */
  beacons: { x: number; y: number; z: number; phase: number }[]
}

/** Horn.os' LCG (s = s * 1664525 + 1013904223): numbers in [0, 1), the same sequence for the same seed. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Horn buildBuildings, in the same order of draws: buildings, then rooftop plant, then beacon phases. */
export function cityLayout(seed = 7): CityLayout {
  const r = seeded(seed)
  const { park, groundY } = OUTDOOR
  const buildings: BuildingSpec[] = []
  const pickStyle = (h: number): BuildingSpec['style'] => {
    const k = r()
    if (h > 55) return k < 0.7 ? CITY_STYLES.glass : CITY_STYLES.concrete
    if (k < 0.35) return CITY_STYLES.brick
    if (k < 0.6) return CITY_STYLES.concrete
    if (k < 0.85) return CITY_STYLES.plaster
    return CITY_STYLES.glass
  }
  const add = (x: number, z: number, w: number, d: number, h: number) => {
    buildings.push({ x, z, w, d, h, style: pickStyle(h), tone: r() })
  }

  // A row of low blocks along the far side of the park.
  for (let z = -160; z < 160; ) {
    const w = 12 + r() * 16
    const d = 14 + r() * 8
    add(park.x1 - d / 2 - r() * 3, z + w / 2, d, w - 0.8, 10 + r() * 13)
    z += w
  }
  // Then a grid of blocks, with more towers in the distance.
  for (let gx = 0; gx < 13; gx++) {
    for (let gz = 0; gz < 20; gz++) {
      if (r() < 0.2) continue
      const x = park.x1 - 50 - gx * 28 - r() * 10
      const z = -280 + gz * 28 + r() * 10
      const far = Math.min(1, gx / 5)
      const tower = r() < 0.1 + far * 0.12
      const h = tower ? 60 + r() * 110 : 12 + r() * 34 * (0.5 + far)
      add(x, z, 14 + r() * 12, 14 + r() * 12, h)
    }
  }

  // Rooftop plant: air-handling units and water tanks on the lower roofs.
  const units: RoofItem[] = []
  const tanks: RoofItem[] = []
  for (const b of buildings) {
    if (b.style === CITY_STYLES.glass || r() < 0.3) continue
    const n = 1 + Math.floor(r() * 3)
    for (let k = 0; k < n; k++) {
      const x = b.x + (r() - 0.5) * b.w * 0.6
      const z = b.z + (r() - 0.5) * b.d * 0.6
      const y = groundY + b.h
      if (r() < 0.25) tanks.push({ x, y, z, sx: 2.4, sy: 3, sz: 2.4 })
      else units.push({ x, y, z, sx: 2 + r() * 3, sy: 1.2 + r(), sz: 1.5 + r() * 2 })
    }
  }

  const beacons = buildings.filter((b) => b.h > 55).map((b) => ({ x: b.x, y: groundY + b.h + 1, z: b.z, phase: r() * 6.28 }))
  return { buildings, units, tanks, beacons }
}

/** The buildings of the city (Horn buildBuildings layout), default seed 7. */
export function buildingPlan(seed = 7): BuildingSpec[] {
  return cityLayout(seed).buildings
}
