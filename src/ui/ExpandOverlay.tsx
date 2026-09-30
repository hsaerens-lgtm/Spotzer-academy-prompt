import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useScreenRef } from '../core/selectors'
import { appStore } from '../core/store'
import { FitScreen } from '../visuals/FitScreen'
import { ScreenContent } from '../visuals/ScreenContent'
import { TokensDemo } from '../visuals/TokensDemo'
import { Button } from './Button'
import './overlay.css'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Keeps Tab / Shift+Tab inside `dialog`: the page behind an aria-modal dialog must not be reachable. */
function trapTab(event: KeyboardEvent, dialog: HTMLElement) {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (!active || !dialog.contains(active)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

export function ExpandOverlay() {
  const { t } = useTranslation()
  const screen = useScreenRef()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const close = () => appStore.getState().setExpandOpen(false)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') appStore.getState().setExpandOpen(false)
      else if (event.key === 'Tab' && dialogRef.current) trapTab(event, dialogRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={dialogRef} className="expand panel" role="dialog" aria-modal="true" aria-label={t('screen.expand')}>
      <div className="expand__bar">
        <Button ref={closeRef} size="sm" variant="solid" onClick={close}>
          {t('screen.close')}
        </Button>
      </div>
      <div className="expand__stage">
        <FitScreen>
          <ScreenContent screen={screen} />
        </FitScreen>
      </div>
      {screen?.visualId === 'tokens' && <TokensDemo />}
    </div>
  )
}
