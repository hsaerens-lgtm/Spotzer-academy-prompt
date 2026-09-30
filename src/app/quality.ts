import { createContext } from 'react'

export type Quality = 'high' | 'medium' | 'low'

export const QualityContext = createContext<Quality>('high')

const ORDER: Quality[] = ['low', 'medium', 'high']

export function nextQuality(current: Quality, event: 'decline' | 'incline' | 'fallback'): Quality {
  if (event === 'fallback') return 'low'
  const index = ORDER.indexOf(current) + (event === 'incline' ? 1 : -1)
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, index))]
}

export function dprFor(quality: Quality): number | [number, number] {
  return quality === 'high' ? [1, 1.5] : 1
}

export interface QualityState {
  level: Quality
  changes: number
  settled: boolean
}
export const INITIAL_QUALITY: QualityState = { level: 'high', changes: 0, settled: false }
const MAX_CHANGES = 3

/** Only real level changes count as flip-flops; after too many, settle on low for good. */
export function reduceQuality(state: QualityState, event: 'decline' | 'incline'): QualityState {
  if (state.settled) return state
  const level = nextQuality(state.level, event)
  if (level === state.level) return state
  const changes = state.changes + 1
  if (changes > MAX_CHANGES) return { level: nextQuality(level, 'fallback'), changes, settled: true }
  return { level, changes, settled: false }
}
