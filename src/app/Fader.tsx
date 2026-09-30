import { useEffect } from 'react'
import { useApp } from '../core/store'

export const FADE_MS = 350

export function Fader() {
  const fading = useApp((s) => s.transition?.stage === 'fade')
  const reduced = useApp((s) => s.reducedMotion)
  const transitionStep = useApp((s) => s.transitionStep)

  useEffect(() => {
    if (!fading) return
    const id = window.setTimeout(transitionStep, reduced ? 0 : FADE_MS)
    return () => window.clearTimeout(id)
  }, [fading, reduced, transitionStep])

  return <div className={`fader${fading ? ' is-on' : ''}`} data-testid="fader" aria-hidden="true" />
}
