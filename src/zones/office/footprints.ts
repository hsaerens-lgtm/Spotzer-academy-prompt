import type { PlantKind } from '../../three/plants/types'
import { BANQUETTE, layout, type Placement, type Vec3 } from './layout'

/*
 * Footprints of everything in the office, as axis-aligned boxes in world space. The layout tests use them to keep
 * sightlines clear (camera -> laptop, camera -> retro corner, presentation view -> wall screen) and every object
 * inside the room. Sizes are generous outer bounds of the real objects, not their exact shapes.
 */

export interface Box {
  name: string
  min: Vec3
  max: Vec3
}

/** Local size [width x, height y, depth z] of each kind of object: origin at the bottom centre, front +z (metres). */
export const SIZES: Record<string, Vec3> = {
  table: [2.5, 0.75, 5.0],
  chair: [0.56, 0.9, 0.56],
  microphone: [0.1, 0.42, 0.22],
  sideboard: [4.88, 0.68, 0.684],
  lamp: [0.28, 0.48, 0.28],
  laptop: [0.34, 0.24, 0.26],
  tvStand: [1.7, 0.5, 0.5],
  tv: [0.4, 0.42, 0.36],
  retroConsole: [0.62, 0.08, 0.3],
  sofa: [2.0, 0.8, 0.9],
  logo: [0.9, 1.116, 0.12], // the backlit sign of Task 10 (plate around the 0.72 x 0.936 m mark), centred vertically on its position
  clock: [0.33, 0.33, 0.05],
  cabinet: [1.15, 1.89, 0.5],
  coffeeTable: [0.6, 0.39, 1.21],
  shelves: [1.4, 1.8, 0.24],
  pendant: [0.44, 0.952, 0.44],
  frame: [0.6, 0.85, 0.02],
  pottedPlant: [0.7, 1.34, 0.7],
  pachira: [1.1, 1.9, 1.1],
  vaseTall: [0.21, 0.41, 0.21],
  vaseRound: [0.19, 0.35, 0.19],
  hangingPlant: [0.5, 1.45, 0.5], // all of it below the ceiling hook
  ada: [0.66, 1.05, 0.5], // from her base at y 1.1 up to 2.15
  // plants, multiplied by their scale
  monstera: [0.95, 0.95, 0.95],
  palm: [1.1, 1.3, 1.1],
  fern: [0.85, 0.6, 0.85],
  pothos: [0.5, 0.45, 0.5],
  succulent: [0.2, 0.15, 0.2],
  herb: [0.25, 0.25, 0.25],
}

/** How far a plant's trailing vines hang below the base of its pot. */
const TRAILING: Partial<Record<PlantKind, number>> = { pothos: 0.6 }

/** World box of an object: x and z swap when it is turned a quarter; `below` extends the box downward (hanging plants, trailing vines). */
export function boxFor(name: string, placement: Placement, size: Vec3, options: { below?: number } = {}): Box {
  const [x, y, z] = placement.position
  const turned = Math.abs(Math.sin(placement.rotationY ?? 0)) > 0.5
  const width = turned ? size[2] : size[0]
  const depth = turned ? size[0] : size[2]
  return {
    name,
    min: [x - width / 2, y - (options.below ?? 0), z - depth / 2],
    max: [x + width / 2, y + size[1], z + depth / 2],
  }
}

/** Every object of the office, by scene name. Recomputed from `layout` on each call (the tuning panel edits it). */
export function sceneBoxes(): Box[] {
  const o = layout.objects
  const boxes: Box[] = [boxFor('table', o.table, SIZES.table)]
  o.chairs.forEach((chair, i) => boxes.push(boxFor(`chair-${i}`, chair, SIZES.chair)))
  o.microphones.forEach((mic, i) => boxes.push(boxFor(`microphone-${i}`, mic, SIZES.microphone)))
  for (const name of ['sideboard', 'lamp', 'laptop', 'tvStand', 'tv', 'retroConsole', 'sofa'] as const) {
    boxes.push(boxFor(name, o[name], SIZES[name]))
  }
  const [lx, ly, lz] = o.logo.position
  boxes.push(boxFor('logo', { position: [lx, ly - SIZES.logo[1] / 2, lz], rotationY: o.logo.rotationY }, SIZES.logo))
  for (const name of ['clock', 'cabinet', 'coffeeTable', 'shelves'] as const) boxes.push(boxFor(name, o[name], SIZES[name]))
  o.pendants.forEach((pendant, i) => boxes.push(boxFor(`pendant-${i}`, pendant, SIZES.pendant)))
  o.frames.forEach((frame, i) => boxes.push(boxFor(`frame-${i}`, frame, SIZES.frame)))
  o.plants.forEach((plant, i) => {
    const [w, h, d] = SIZES[plant.kind]
    const s = plant.scale
    boxes.push(boxFor(`plant-${i}`, plant, [w * s, h * s, d * s], { below: TRAILING[plant.kind] ?? 0 }))
  })
  o.hangingPlants.forEach((hanging, i) => {
    const [w, h, d] = SIZES.hangingPlant
    boxes.push(boxFor(`hangingPlant-${i}`, hanging, [w, 0, d], { below: h }))
  })
  boxes.push(boxFor('pottedPlant', o.largePlants.pottedPlant, SIZES.pottedPlant))
  boxes.push(boxFor('pachira', o.largePlants.pachira, SIZES.pachira))
  o.vases.forEach((vase, i) => boxes.push(boxFor(`vase-${i}`, vase, SIZES[vase.model])))
  boxes.push({ name: 'banquette', min: [BANQUETTE.x0, 0, BANQUETTE.z0], max: [BANQUETTE.x1, BANQUETTE.height, BANQUETTE.z1] })
  boxes.push(boxFor('ada', layout.ada, SIZES.ada))
  return boxes
}

/** Slab test: does the segment a -> b (endpoints included) touch the box? */
export function segmentHitsBox(a: Vec3, b: Vec3, box: Box): boolean {
  let t0 = 0
  let t1 = 1
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k]
    if (Math.abs(d) < 1e-12) {
      if (a[k] < box.min[k] || a[k] > box.max[k]) return false
      continue
    }
    let ta = (box.min[k] - a[k]) / d
    let tb = (box.max[k] - a[k]) / d
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta)
    t1 = Math.min(t1, tb)
    if (t0 > t1) return false
  }
  return true
}
