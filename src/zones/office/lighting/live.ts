import { useEffect, useLayoutEffect, useRef } from 'react'
import { CLOCK_MINUTES, clockMinutes, easePhase, phaseProgress, type Phase, type PhaseTransition } from '../../../core/phase'
import { PRESETS, clonePreset, mixPreset, type Preset } from './presets'

/*
 * The lighting of the current frame, and the components that apply it. One value drives everything (spec section 4):
 * PhaseDriver computes the live preset once per frame and hands it to every registered applier (lights, sky, city,
 * emissive materials, clock hands), which only write into three.js objects: nothing re-renders React per frame.
 */

export interface LiveLighting {
  preset: Preset
  /** The time the wall clock shows, in minutes after midnight. */
  minutes: number
  /** The transition has reached its end: PhaseDriver clears it. */
  finished: boolean
}

/** Copies a preset into `out` (a blend of the preset with itself at 0 is an exact copy). */
const copyInto = (preset: Preset, out: Preset) => mixPreset(preset, preset, 0, out)

/**
 * The lighting at `now` (performance.now() milliseconds): the phase preset at rest, the eased blend of a running
 * transition, and exactly the target preset once the transition is over. Writes into `out` when given.
 */
export function computeLive(phase: Phase, transition: PhaseTransition | null, now: number, out?: LiveLighting): LiveLighting {
  const live = out ?? { preset: clonePreset(PRESETS[phase]), minutes: CLOCK_MINUTES[phase], finished: false }
  if (!transition) {
    copyInto(PRESETS[phase], live.preset)
    live.minutes = CLOCK_MINUTES[phase]
    live.finished = false
    return live
  }
  const k = phaseProgress(transition.startedAt, now)
  if (k >= 1) {
    // Land exactly on the target: a blend at 1 can be off by a rounding error.
    copyInto(PRESETS[transition.to], live.preset)
    live.minutes = CLOCK_MINUTES[transition.to]
    live.finished = true
    return live
  }
  const e = easePhase(k)
  mixPreset(PRESETS[transition.from], PRESETS[transition.to], e, live.preset)
  live.minutes = clockMinutes(transition.from, transition.to, e)
  live.finished = false
  return live
}

/** Writes the live lighting into three.js objects. Must not keep or change the preset it receives. */
export type LightingApplier = (preset: Readonly<Preset>, minutes: number) => void

const appliers = new Set<LightingApplier>()

/** Adds an applier; returns the function that removes it. */
export function registerLightingApplier(apply: LightingApplier): () => void {
  appliers.add(apply)
  return () => {
    appliers.delete(apply)
  }
}

/** Hands the live lighting to every registered applier (PhaseDriver, once per frame). */
export function applyLighting(preset: Readonly<Preset>, minutes: number): void {
  for (const apply of appliers) apply(preset, minutes)
}

/** Registers `apply` while the component is mounted; always calls its latest version. */
export function useLightingApplier(apply: LightingApplier): void {
  const latest = useRef(apply)
  useLayoutEffect(() => {
    latest.current = apply
  })
  useEffect(() => registerLightingApplier((preset, minutes) => latest.current(preset, minutes)), [])
}
