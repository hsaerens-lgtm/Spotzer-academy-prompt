import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Mood } from '../../../content/schema'
import { sound } from '../../../core/sound'
import { useApp } from '../../../core/store'
import { useTypewriter } from '../../../ui/useTypewriter'
import { Ada2D } from './Ada2D'

export interface AdaBubbleProps {
  text: string | null
  mood?: Mood
  pointing?: boolean
  actions?: ReactNode
  onDismiss?: () => void
}

const noop = () => {}

/** Past this many characters a line runs over four lines of the narrowest bubble: the desktop grows Ada's row for it. */
export const LONG_LINE = 180

/**
 * Types its line with blips; screen readers get the whole line at once. Keyed on the text, so every line starts from
 * nothing. The rest of the line already holds its place, hidden: the bubble has its final size from the first
 * character, so Ada's row in the desktop grid never grows (and never moves the windows above it) mid-line.
 */
function TypedText({ text, reduced }: { text: string; reduced: boolean }) {
  const shown = useTypewriter(text, { active: !reduced, onDone: noop, onReveal: (char, index) => sound.blip(char, index) })
  return (
    <>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      {shown < text.length && (
        <span aria-hidden="true" className="ws-bubble__untyped">
          {text.slice(shown)}
        </span>
      )}
      <span className="sr-only">{text}</span>
    </>
  )
}

/** Ada in the corner, Clippy-style. The typewriter never captures keys, so typing in the editors stays free. */
export function AdaBubble({ text, mood = 'neutral', pointing = false, actions, onDismiss }: AdaBubbleProps) {
  const { t } = useTranslation()
  const reduced = useApp((s) => s.reducedMotion)

  useEffect(() => {
    if (!text || !onDismiss) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [text, onDismiss])

  return (
    <aside className="ws-ada-dock" aria-label={t('workshop.ada.name')}>
      {text && (
        <div className={text.length > LONG_LINE ? 'ws-bubble ws-bubble--long' : 'ws-bubble'}>
          <p className="ws-bubble__text">
            <TypedText key={text} text={text} reduced={reduced} />
          </p>
          {actions && <div className="ws-bubble__actions">{actions}</div>}
          {onDismiss && (
            <button type="button" className="ws-bubble__close" aria-label={t('workshop.ada.close')} onClick={onDismiss}>
              <span aria-hidden="true">&times;</span>
            </button>
          )}
        </div>
      )}
      <Ada2D mood={mood} pointing={pointing} />
    </aside>
  )
}
