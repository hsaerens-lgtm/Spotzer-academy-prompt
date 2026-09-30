import { bumpLayout, layout, type Vec3 } from './layout'

export const TUNABLE = ['ada', 'screen', 'table', 'sideboard', 'lamp', 'laptop', 'cabinet', 'tv', 'retroConsole', 'sofa', 'logo'] as const
export type Tunable = (typeof TUNABLE)[number]

export function isTuneEnabled(search: string, dev: boolean): boolean {
  return dev && new URLSearchParams(search).has('tune')
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
