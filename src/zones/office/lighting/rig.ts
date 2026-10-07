import type { QualitySettings } from '../../../app/quality'
import { CEILING_LINES, type Vec3 } from '../layout'

/*
 * The light rig of the office (Horn.os office.js buildLights, refitted to a 10 x 12 m room): one shadow caster (the
 * sun, the moon at night) coming in sideways through the glazing, a sky fill, the daylight of the whole facade as
 * an area light, and the practical lights of the room. Colours of lights live here and in presets.ts only.
 * Intensities follow the time of day through presets.ts (Lights.tsx applies them); these are the fixed parts.
 */
export const RIG = {
  sun: { shadowBias: -0.0004, normalBias: 0.02, camera: { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 26 } },
  window: { position: [-4.97, 1.6, -0.8] as Vec3, lookAt: [0, 1.6, -0.8] as Vec3, width: 10.4, height: 3.2 },
  ceilingLines: { y: 3.18, width: 0.12, length: 7.2, nits: 12 }, // RectAreaLights rotated [-PI/2, 0, 0], one per CEILING_LINES entry
  pendant: { candela: 6, distance: 6, decay: 2, colour: '#ffd9a8' },
  lamp: { colour: '#ffd6a0', angle: 0.75, penumbra: 0.6, distance: 3, decay: 2 },
  screenGlow: { colour: '#9fb8c8', distance: 4, decay: 2 },
  emissivePeak: 2.5,
  environment: {
    resolution: 256,
    lightformers: [
      { name: 'window', position: [-6, 1.6, -0.8], rotation: [0, Math.PI / 2, 0], scale: [10, 3], intensity: 1.6, colour: '#e8f0ff' },
      { name: 'ceiling', position: [-1, 4, -1.5], rotation: [Math.PI / 2, 0, 0], scale: [6, 8], intensity: 0.8, colour: '#fff1dc' },
      { name: 'camera-side', position: [0, 1.6, 8], rotation: [0, Math.PI, 0], scale: [10, 3], intensity: 0.35, colour: '#f3ece2' },
      { name: 'floor-bounce', position: [-1, -1, -1.5], rotation: [-Math.PI / 2, 0, 0], scale: [8, 10], intensity: 0.25, colour: '#c8a782' },
    ],
  },
} as const

export type RigLightKind = 'directional' | 'hemisphere' | 'rectArea' | 'spot' | 'point'

/**
 * The lights of a quality tier, by scene name. The list never depends on the phase: a light that a phase switches
 * off stays mounted at intensity 0, because a change in the number of lights recompiles every material.
 */
export function rigLights(settings: QualitySettings): { name: string; kind: RigLightKind }[] {
  const lights: { name: string; kind: RigLightKind }[] = [
    { name: 'sun', kind: 'directional' },
    { name: 'sky-fill', kind: 'hemisphere' },
    { name: 'window-light', kind: 'rectArea' },
    { name: 'lamp-light', kind: 'spot' },
    { name: 'screen-glow', kind: 'point' },
  ]
  if (settings.accentLights) {
    CEILING_LINES.forEach((_, i) => lights.push({ name: `ceiling-light-${i}`, kind: 'rectArea' }))
    lights.push({ name: 'pendant-light', kind: 'point' })
  }
  return lights
}
