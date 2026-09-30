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
