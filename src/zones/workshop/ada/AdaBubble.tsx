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

/** Ada in the corner, Clippy-style. The typewriter never captures keys, so typing in the editors stays free. */
export function AdaBubble({ text, mood = 'neutral', pointing = false, actions, onDismiss }: AdaBubbleProps) {
  const { t } = useTranslation()
  const reduced = useApp((s) => s.reducedMotion)
  const shown = useTypewriter(text ?? '', { active: !reduced && !!text, onDone: noop, onReveal: (char, index) => sound.blip(char, index) })

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
        <div className="ws-bubble">
          <p className="ws-bubble__text">
            <span aria-hidden="true">{text.slice(0, shown)}</span>
            <span className="sr-only">{text}</span>
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
