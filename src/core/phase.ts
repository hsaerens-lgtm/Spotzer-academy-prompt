/*
 * Time of day: the three phases of the office, the hours that choose one on arrival, the `?phase=` override,
 * and the progress of a transition. Pure (no import): the store, the lighting and the clock all read it.
 */
export const PHASES = ['day', 'sunset', 'night'] as const
export type Phase = (typeof PHASES)[number]
/** A running change of phase. startedAt: performance.now() milliseconds. */
export interface PhaseTransition {
  from: Phase
  to: Phase
  startedAt: number
}
export const PHASE_SECONDS = 2.5
/** The time the wall clock shows in each phase, in minutes after midnight (14:00, 19:30, 23:00). */
export const CLOCK_MINUTES: Record<Phase, number> = { day: 14 * 60, sunset: 19 * 60 + 30, night: 23 * 60 }

const isPhase = (value: string): value is Phase => (PHASES as readonly string[]).includes(value)

/** Local hours: day 07:00-17:59, sunset 18:00-20:59, night 21:00-06:59. */
export function phaseForTime(date: Date): Phase {
  const hour = date.getHours()
  if (hour >= 7 && hour < 18) return 'day'
  if (hour >= 18 && hour < 21) return 'sunset'
  return 'night'
}

/** day -> sunset -> night -> day */
export function nextPhase(phase: Phase): Phase {
  return PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length]
}

/** `?phase=day|sunset|night` (exact lower case), read from a location search string; null for anything else. */
export function parsePhaseParam(search: string): Phase | null {
  const value = new URLSearchParams(search).get('phase')
  return value !== null && isPhase(value) ? value : null
}

/** Linear progress of a transition, 0 at its start, 1 once PHASE_SECONDS have passed. */
export function phaseProgress(startedAt: number, now: number): number {
  return Math.min(1, Math.max(0, (now - startedAt) / (PHASE_SECONDS * 1000)))
}

/** Cubic ease in and out: slow start, slow landing. */
export function easePhase(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
}

/** Clock time during a transition: always forward, through midnight when going from night to day. */
export function clockMinutes(from: Phase, to: Phase, e: number): number {
  const span = (CLOCK_MINUTES[to] - CLOCK_MINUTES[from] + 1440) % 1440
  return (CLOCK_MINUTES[from] + span * e) % 1440
}
