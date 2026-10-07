import { Color, Vector3 } from 'three'
import { PHASES } from '../../../core/phase'
import { PRESETS, PRESET_KEYS, SUN_TARGET, clonePreset, mixPreset, type Preset } from './presets'

/** Every key of `actual` equals `expected` (colours and vectors component by component, to 1e-9). */
function expectPreset(actual: Preset, expected: Preset) {
  for (const key of PRESET_KEYS) {
    const a = actual[key]
    const e = expected[key]
    const parts = (value: typeof a) =>
      value instanceof Color ? value.toArray() : value instanceof Vector3 ? value.toArray() : [value as number]
    parts(a).forEach((n, i) => expect(n, key).toBeCloseTo(parts(e)[i], 9))
  }
}

test('PRESETS are complete for each phase', () => {
  expect(PRESET_KEYS).toHaveLength(24)
  for (const phase of PHASES) {
    const preset = PRESETS[phase]
    expect(Object.keys(preset).sort(), phase).toEqual([...PRESET_KEYS].sort())
    for (const key of PRESET_KEYS) {
      const value = preset[key]
      const reference = PRESETS.day[key]
      if (reference instanceof Color) expect(value, `${phase}.${key}`).toBeInstanceOf(Color)
      else if (reference instanceof Vector3) expect(value, `${phase}.${key}`).toBeInstanceOf(Vector3)
      else expect(Number.isFinite(value), `${phase}.${key}`).toBe(true)
    }
  }
  expect(SUN_TARGET.toArray()).toEqual([-1, 0, -1.8])
})

test('spec values: environment and exposure per phase', () => {
  expect(PHASES.map((phase) => PRESETS[phase].environment)).toEqual([0.32, 0.18, 0.05])
  expect(PHASES.map((phase) => PRESETS[phase].exposure)).toEqual([1.0, 1.0, 1.15])
})

test('mixPreset returns a at 0 and b at 1', () => {
  expectPreset(mixPreset(PRESETS.day, PRESETS.night, 0), PRESETS.day)
  expectPreset(mixPreset(PRESETS.day, PRESETS.night, 1), PRESETS.night)
  expectPreset(mixPreset(PRESETS.sunset, PRESETS.sunset, 0.4), PRESETS.sunset)
})

test('mixPreset blends colours, vectors and numbers halfway', () => {
  const { day, night } = PRESETS
  const half = mixPreset(day, night, 0.5)
  expect(half.sunIntensity).toBeCloseTo((4.2 + 0.45) / 2)
  expect(half.exposure).toBeCloseTo(1.075)
  half.sunPosition.toArray().forEach((n, i) => expect(n).toBeCloseTo((day.sunPosition.getComponent(i) + night.sunPosition.getComponent(i)) / 2))
  expect(half.sunColor.r).toBeCloseTo((day.sunColor.r + night.sunColor.r) / 2)
  expect(half.sunColor.g).toBeCloseTo((day.sunColor.g + night.sunColor.g) / 2)
  expect(half.skyTop.b).toBeCloseTo((day.skyTop.b + night.skyTop.b) / 2)
})

test('mixPreset writes into out without touching its inputs', () => {
  const day = clonePreset(PRESETS.day)
  const night = clonePreset(PRESETS.night)
  const out = clonePreset(PRESETS.sunset)
  const sunColor = out.sunColor
  expect(mixPreset(PRESETS.day, PRESETS.night, 0.3, out)).toBe(out)
  expect(out.sunColor).toBe(sunColor)
  expectPreset(PRESETS.day, day)
  expectPreset(PRESETS.night, night)
  const fresh = mixPreset(PRESETS.day, PRESETS.night, 0.3)
  expect(fresh.sunColor).not.toBe(PRESETS.day.sunColor)
  expect(fresh.sunPosition).not.toBe(PRESETS.day.sunPosition)
  expectPreset(fresh, out)
})
