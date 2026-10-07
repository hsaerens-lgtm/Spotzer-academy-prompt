import { CLOCK_MINUTES, PHASES, PHASE_SECONDS, type PhaseTransition } from '../../../core/phase'
import { applyLighting, computeLive, registerLightingApplier } from './live'
import { PRESETS, mixPreset } from './presets'

const MS = PHASE_SECONDS * 1000

test('without a transition the live lighting is the phase preset', () => {
  for (const phase of PHASES) {
    const live = computeLive(phase, null, 123)
    expect(live.preset, phase).toEqual(PRESETS[phase])
    // A copy: an applier can never change the presets.
    expect(live.preset.sunColor).not.toBe(PRESETS[phase].sunColor)
    expect(live.preset.sunPosition).not.toBe(PRESETS[phase].sunPosition)
    expect(live.minutes).toBe(CLOCK_MINUTES[phase])
    expect(live.finished).toBe(false)
  }
})

test('mid-transition values are the eased mix', () => {
  const transition: PhaseTransition = { from: 'day', to: 'sunset', startedAt: 1000 }
  // A quarter of the time is 1/16 of the way (cubic ease in and out).
  const quarter = computeLive('sunset', transition, 1000 + MS / 4)
  const expected = mixPreset(PRESETS.day, PRESETS.sunset, 0.0625)
  expect(quarter.finished).toBe(false)
  expect(quarter.preset.sunIntensity).toBeCloseTo(expected.sunIntensity)
  quarter.preset.sunPosition.toArray().forEach((n, i) => expect(n).toBeCloseTo(expected.sunPosition.getComponent(i)))
  expect(quarter.preset.skyHorizon.r).toBeCloseTo(expected.skyHorizon.r)
  expect(quarter.preset.environment).toBeCloseTo(expected.environment)
  // Half the time is half the way.
  const half = computeLive('sunset', transition, 1000 + MS / 2)
  expect(half.preset.sunIntensity).toBeCloseTo((PRESETS.day.sunIntensity + PRESETS.sunset.sunIntensity) / 2)
})

// Review focus 1: the transition ends exactly on the next phase, nothing half applied.
test('a finished transition lands exactly on the target preset', () => {
  const transition: PhaseTransition = { from: 'night', to: 'day', startedAt: 5000 }
  expect(computeLive('day', transition, 5000 + MS - 16).finished).toBe(false)
  for (const now of [5000 + MS, 5000 + MS + 1, 5000 + 60_000]) {
    const live = computeLive('day', transition, now)
    expect(live.finished).toBe(true)
    expect(live.preset).toEqual(PRESETS.day)
    expect(live.minutes).toBe(CLOCK_MINUTES.day)
  }
  // It writes into the object it is given, the one PhaseDriver keeps from frame to frame.
  const out = computeLive('night', null, 0)
  expect(computeLive('day', transition, 5000 + MS, out)).toBe(out)
  expect(out.preset).toEqual(PRESETS.day)
})

test("appliers receive each frame's preset and can unregister", () => {
  const seen: [number, number][] = []
  const stop = registerLightingApplier((preset, minutes) => {
    seen.push([preset.sunIntensity, minutes])
  })
  const other = vi.fn()
  const stopOther = registerLightingApplier(other)
  applyLighting(PRESETS.day, CLOCK_MINUTES.day)
  applyLighting(PRESETS.night, CLOCK_MINUTES.night)
  stop()
  applyLighting(PRESETS.sunset, CLOCK_MINUTES.sunset)
  expect(seen).toEqual([
    [PRESETS.day.sunIntensity, CLOCK_MINUTES.day],
    [PRESETS.night.sunIntensity, CLOCK_MINUTES.night],
  ])
  expect(other).toHaveBeenCalledTimes(3)
  expect(other).toHaveBeenLastCalledWith(PRESETS.sunset, CLOCK_MINUTES.sunset)
  stopOther()
  applyLighting(PRESETS.day, CLOCK_MINUTES.day)
  expect(other).toHaveBeenCalledTimes(3)
})

test('the clock turns forward during a transition', () => {
  const transition: PhaseTransition = { from: 'night', to: 'day', startedAt: 0 }
  let previous = CLOCK_MINUTES.night
  let turned = 0
  for (let i = 1; i <= 10; i++) {
    const minutes = computeLive('day', transition, (i / 10) * MS).minutes
    const step = (minutes - previous + 1440) % 1440
    expect(step, `step ${i}`).toBeLessThan(720) // never backwards
    turned += step
    previous = minutes
  }
  expect(turned).toBeCloseTo(15 * 60) // 23:00 to 14:00, through midnight
  expect(computeLive('day', transition, MS / 2).minutes).toBe(6 * 60 + 30)
})
