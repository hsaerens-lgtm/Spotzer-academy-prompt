import { bumpLayout, layout, type Vec3 } from './layout'

export const TUNABLE = ['ada', 'screen', 'table', 'sideboard', 'lamp', 'laptop', 'tvStand', 'tv', 'retroConsole', 'sofa', 'floorLamp', 'logo', 'clock', 'cabinet', 'coffeeTable', 'shelves'] as const
export type Tunable = (typeof TUNABLE)[number]

export function isTuneEnabled(search: string, dev: boolean): boolean {
  return dev && new URLSearchParams(search).has('tune')
}

/** Scene lights that move with a tunable object, at their layout position: the floor lamp's light, in its shade. */
export function linkedLights(name: Tunable): { name: string; position: Vec3 }[] {
  return name === 'floorLamp' ? [{ name: 'floor-lamp-light', position: layout.lights.floorLamp.position }] : []
}

/** Writes a transform made in the tuning panel back into the layout. */
export function applyTransform(name: Tunable, position: Vec3, rotationY: number) {
  if (name === 'ada') {
    layout.ada.position = position
    layout.ada.rotationY = rotationY
  } else if (name === 'screen') {
    layout.screen.position = position
  } else {
    const entry = layout.objects[name]
    if (name === 'floorLamp') {
      // Its light moves by as much, so it stays at the centre of the shade (linkedLights).
      const light = layout.lights.floorLamp.position
      layout.lights.floorLamp.position = [0, 1, 2].map((k) => light[k] + position[k] - entry.position[k]) as Vec3
    }
    entry.position = position
    if (entry.rotationY !== undefined) entry.rotationY = rotationY
  }
  bumpLayout()
}

/** The values to paste back into layout.ts once the scene looks right. */
export function layoutSnapshot() {
  const { rail, flights, objects, screen, ada, lights } = layout
  return JSON.parse(JSON.stringify({ rail, flights, objects, screen, ada, lights })) as Record<string, unknown>
}
