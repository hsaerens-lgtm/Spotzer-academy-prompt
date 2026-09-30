import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useScreenRef } from '../core/selectors'
import { appStore } from '../core/store'
import { FitScreen } from '../visuals/FitScreen'
import { ScreenContent } from '../visuals/ScreenContent'
import { Button } from './Button'
import './overlay.css'

export function ExpandOverlay() {
  const { t } = useTranslation()
  const screen = useScreenRef()
  const closeRef = useRef<HTMLButtonElement>(null)
  const close = () => appStore.getState().setExpandOpen(false)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') appStore.getState().setExpandOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="expand panel" role="dialog" aria-modal="true" aria-label={t('screen.expand')}>
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
    </div>
  )
}
