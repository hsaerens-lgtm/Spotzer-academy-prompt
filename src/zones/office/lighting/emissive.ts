import type { Materials } from '../../../three/materials'
import { useLightingApplier } from './live'
import { RIG } from './rig'

/**
 * Emissive levels of the shared materials through the day: the ceiling strips and the lamp shade light up at dusk,
 * brighter than white at night (Horn.os rule: practicals above 1.0). The Athena sign is a backlit plate, not a lamp: its
 * level (preset `sign`) stays at most 0.5, where ACES leaves the brand colours of the cubes in front of it intact (Task 10
 * review: at 2.5 the plate read sRGB 246 and the lime cubes pastel). The ink squares keep a faint constant glow: light on
 * the wall by day, dark against the lit plate at night.
 */
export function useEmissiveLevels(m: Materials): void {
  useLightingApplier((p) => {
    m.ceilingStrip.emissiveIntensity = p.bulb * RIG.emissivePeak
    m.lampShade.emissiveIntensity = Math.min(1, p.lampIntensity) * RIG.emissivePeak
    m.signBack.emissiveIntensity = p.sign
    m.logoLime.emissiveIntensity = 0.4 + 0.4 * p.sign
    m.logoMint.emissiveIntensity = 0.4 + 0.4 * p.sign
    m.logoInk.emissiveIntensity = 0.1
  })
}
