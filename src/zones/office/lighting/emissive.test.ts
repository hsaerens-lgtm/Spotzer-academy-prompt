import { renderHook } from '@testing-library/react'
import { Texture } from 'three'
import { PHASES } from '../../../core/phase'
import { TEXTURE_SET_IDS } from '../../../three/assets'
import { buildMaterials } from '../../../three/materials'
import type { TextureSets } from '../../../three/textures'
import { useEmissiveLevels } from './emissive'
import { applyLighting } from './live'
import { PRESETS } from './presets'

function fakeSets(): TextureSets {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
  return sets
}

test('the sign follows the phase while the ink squares keep the glow they are built with', () => {
  const m = buildMaterials(fakeSets())
  const { unmount } = renderHook(() => useEmissiveLevels(m))
  for (const phase of PHASES) {
    // One source of truth (Task 10 review): only materials.ts sets the ink level. A level the applier would overwrite
    // shows it still writing there.
    m.logoInk.emissiveIntensity = 0.123
    applyLighting(PRESETS[phase], 0)
    expect(m.logoInk.emissiveIntensity, phase).toBe(0.123)
    expect(m.signBack.emissiveIntensity, phase).toBe(PRESETS[phase].sign)
    expect(m.logoLime.emissiveIntensity, phase).toBeCloseTo(0.4 + 0.4 * PRESETS[phase].sign)
  }
  unmount()
})
