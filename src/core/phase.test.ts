import {
  CLOCK_MINUTES,
  PHASE_SECONDS,
  clockMinutes,
  easePhase,
  nextPhase,
  parsePhaseParam,
  phaseForTime,
  phaseProgress,
} from './phase'

const at = (hours: number, minutes: number) => new Date(2026, 9, 6, hours, minutes)

test('phaseForTime follows the spec bounds', () => {
  expect(phaseForTime(at(6, 59))).toBe('night')
  expect(phaseForTime(at(7, 0))).toBe('day')
  expect(phaseForTime(at(17, 59))).toBe('day')
  expect(phaseForTime(at(18, 0))).toBe('sunset')
  expect(phaseForTime(at(20, 59))).toBe('sunset')
  expect(phaseForTime(at(21, 0))).toBe('night')
  expect(phaseForTime(at(0, 0))).toBe('night')
})

test('nextPhase cycles day, sunset, night', () => {
  expect(nextPhase('day')).toBe('sunset')
  expect(nextPhase('sunset')).toBe('night')
  expect(nextPhase('night')).toBe('day')
})

// Review focus 4: hand-written addresses.
test('parsePhaseParam accepts only day, sunset and night', () => {
  expect(parsePhaseParam('?phase=night')).toBe('night')
  expect(parsePhaseParam('?tune&phase=sunset')).toBe('sunset')
  expect(parsePhaseParam('phase=day')).toBe('day')
  expect(parsePhaseParam('?phase=NIGHT')).toBeNull()
  expect(parsePhaseParam('?phase=')).toBeNull()
  expect(parsePhaseParam('?phase=dawn')).toBeNull()
  expect(parsePhaseParam('?phase=%%%')).toBeNull()
  expect(parsePhaseParam('')).toBeNull()
})

test('phase progress is clamped and eased', () => {
  expect(PHASE_SECONDS).toBe(2.5)
  expect(phaseProgress(1000, 500)).toBe(0)
  expect(phaseProgress(1000, 1000)).toBe(0)
  expect(phaseProgress(1000, 2250)).toBe(0.5)
  expect(phaseProgress(1000, 3500)).toBe(1)
  expect(phaseProgress(1000, 60_000)).toBe(1)
  expect(easePhase(0)).toBe(0)
  expect(easePhase(0.25)).toBeCloseTo(0.0625)
  expect(easePhase(0.5)).toBe(0.5)
  expect(easePhase(0.75)).toBeCloseTo(0.9375)
  expect(easePhase(1)).toBe(1)
})

test('the clock turns forward, through midnight from night to day', () => {
  expect(CLOCK_MINUTES).toEqual({ day: 840, sunset: 1170, night: 1380 })
  expect(clockMinutes('day', 'sunset', 0)).toBe(840)
  expect(clockMinutes('day', 'sunset', 0.5)).toBe(1005)
  expect(clockMinutes('day', 'sunset', 1)).toBe(1170)
  expect(clockMinutes('sunset', 'night', 1)).toBe(1380)
  expect(clockMinutes('night', 'day', 0.5)).toBe(390)
  expect(clockMinutes('night', 'day', 1)).toBe(840)
})
