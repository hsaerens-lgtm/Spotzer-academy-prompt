// Ported from Horn.os (owner's project): js/scene/daycycle.js
import { Color, Vector3 } from 'three'
import type { Phase } from '../../../core/phase'

/** Everything the time of day changes. One mixed Preset drives the lights, the exposure, the sky and the city at once. */
export interface Preset {
  sunColor: Color
  sunIntensity: number
  sunPosition: Vector3
  hemiSky: Color
  hemiGround: Color
  hemiIntensity: number
  environment: number
  windowColor: Color
  windowIntensity: number
  /** 0..1 level of the ceiling-line RectAreaLights and the pendant PointLight (high tier only). */
  ceiling: number
  /**
   * 0..1 level of the emissive pendant bulbs and ceiling strips (x RIG.emissivePeak), and of the pendants' frosted
   * shells, which glow with their bulbs (x RIG.pendantShellPeak).
   */
  bulb: number
  /** Sideboard lamp SpotLight, candela. */
  lampIntensity: number
  /** Logo sign backlight emissive intensity; at most 0.5, so the brand cubes in front keep their colours (emissive.ts). */
  sign: number
  /** Wall-screen glow PointLight, candela. */
  screenGlow: number
  exposure: number
  skyTop: Color
  skyHorizon: Color
  sunDisc: Color
  sunSize: number
  stars: number
  /** 0..1: lit city windows and shopfronts, tower beacons; birds fly below 0.6. */
  night: number
  cityAmbient: Color
  cloudColor: Color
  cloudOpacity: number
}

export const PRESET_KEYS: readonly (keyof Preset)[] = [
  'sunColor',
  'sunIntensity',
  'sunPosition',
  'hemiSky',
  'hemiGround',
  'hemiIntensity',
  'environment',
  'windowColor',
  'windowIntensity',
  'ceiling',
  'bulb',
  'lampIntensity',
  'sign',
  'screenGlow',
  'exposure',
  'skyTop',
  'skyHorizon',
  'sunDisc',
  'sunSize',
  'stars',
  'night',
  'cityAmbient',
  'cloudColor',
  'cloudOpacity',
]

/** The table centre: the sun (or the moon) aims here, through the glazing. */
export const SUN_TARGET = new Vector3(-1.0, 0, -1.8)

const C = (hex: string) => new Color(hex)
const V = (x: number, y: number, z: number) => new Vector3(x, y, z)

/**
 * Horn.os values, refitted to a 10 x 12 m room whose glazing is the wall x = -5.
 * The sun doubles as the moon at night: cool, faint, still the one shadow caster.
 * environment and exposure are fixed by the spec; the other values are tuned on screenshots (Task 7).
 */
export const PRESETS: Record<Phase, Preset> = {
  day: {
    sunColor: C('#fff0d8'), sunIntensity: 8, sunPosition: V(-10.86, 6.13, 1.26),
    hemiSky: C('#dfe9f5'), hemiGround: C('#b89c7c'), hemiIntensity: 0.85,
    environment: 0.32, windowColor: C('#e4eefc'), windowIntensity: 2.6,
    ceiling: 0, bulb: 0, lampIntensity: 0, sign: 0.15, screenGlow: 0.35, exposure: 1.0,
    skyTop: C('#4f8fd6'), skyHorizon: C('#d6e4ee'), sunDisc: C('#fff4de'), sunSize: 1,
    stars: 0, night: 0, cityAmbient: C('#9aa6b4'), cloudColor: C('#ffffff'), cloudOpacity: 0.9,
  },
  sunset: {
    sunColor: C('#ff8a4c'), sunIntensity: 3.6, sunPosition: V(-13.28, 2.42, 4.5),
    hemiSky: C('#f2b894'), hemiGround: C('#6a4a3a'), hemiIntensity: 0.32,
    environment: 0.18, windowColor: C('#ffb07e'), windowIntensity: 1.8,
    ceiling: 0.35, bulb: 0.25, lampIntensity: 1.1, sign: 0.35, screenGlow: 0.7, exposure: 1.0,
    skyTop: C('#3b4c86'), skyHorizon: C('#f6a56a'), sunDisc: C('#ffb870'), sunSize: 2.4,
    stars: 0.15, night: 0.45, cityAmbient: C('#8a6a74'), cloudColor: C('#ffa98a'), cloudOpacity: 0.85,
  },
  night: {
    sunColor: C('#8fa6e8'), sunIntensity: 0.45, sunPosition: V(-10.5, 6.0, -3.5),
    hemiSky: C('#2a3550'), hemiGround: C('#16110d'), hemiIntensity: 0.12,
    environment: 0.05, windowColor: C('#5b6fa8'), windowIntensity: 0.35,
    ceiling: 1, bulb: 1, lampIntensity: 1.8, sign: 0.4, screenGlow: 1.0, exposure: 1.15,
    skyTop: C('#050918'), skyHorizon: C('#1c2748'), sunDisc: C('#c8d4ff'), sunSize: 0.8,
    stars: 1, night: 1, cityAmbient: C('#1a2030'), cloudColor: C('#3a4466'), cloudOpacity: 0.35,
  },
}

type PresetValue = Preset[keyof Preset]

/** A deep copy: its colours and vectors are new objects. */
export function clonePreset(preset: Preset): Preset {
  const copy = { ...preset }
  const values = copy as Record<keyof Preset, PresetValue>
  for (const key of PRESET_KEYS) {
    const value = preset[key]
    if (value instanceof Color || value instanceof Vector3) values[key] = value.clone()
  }
  return copy
}

/**
 * a -> b at t (0..1), key by key: colours and vectors are lerped, numbers too. Writes into `out` (a fresh copy of `a`
 * when omitted) and returns it; never changes `a` or `b`, so `out` must be neither of them.
 */
export function mixPreset(a: Preset, b: Preset, t: number, out: Preset = clonePreset(a)): Preset {
  const values = out as Record<keyof Preset, PresetValue>
  for (const key of PRESET_KEYS) {
    const from = a[key]
    const to = b[key]
    if (from instanceof Color) (values[key] as Color).copy(from).lerp(to as Color, t)
    else if (from instanceof Vector3) (values[key] as Vector3).copy(from).lerp(to as Vector3, t)
    else values[key] = from + ((to as number) - from) * t
  }
  return out
}
