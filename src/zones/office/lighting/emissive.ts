import type { Materials } from '../../../three/materials'
import { useLightingApplier } from './live'
import { RIG } from './rig'

/**
 * Emissive levels of the shared materials through the day: the ceiling strips and the lamp shade light up at dusk,
 * brighter than white at night (Horn.os rule: practicals above 1.0); the Athena sign is discreet by day, bright at night.
 */
export function useEmissiveLevels(m: Materials): void {
  useLightingApplier((p) => {
    m.ceilingStrip.emissiveIntensity = p.bulb * RIG.emissivePeak
    m.lampShade.emissiveIntensity = Math.min(1, p.lampIntensity) * RIG.emissivePeak
    m.signBack.emissiveIntensity = p.sign
    m.logoLime.emissiveIntensity = 0.4 + 0.4 * p.sign
    m.logoMint.emissiveIntensity = 0.4 + 0.4 * p.sign
    m.logoInk.emissiveIntensity = 0.2 + 0.3 * p.sign
  })
}
