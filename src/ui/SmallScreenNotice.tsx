import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import './overlay.css'

export const MIN_WIDTH = 1280
export const MIN_HEIGHT = 720

/** The spec (8.6) sets the minimum on the screen, not on the window: a 1280 × 720 screen leaves a viewport of ~1280 × 600. */
const isSmall = () => window.screen.width < MIN_WIDTH || window.screen.height < MIN_HEIGHT

export function SmallScreenNotice() {
  const { t } = useTranslation()
  const [small, setSmall] = useState(isSmall)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    // Dragging the window to another monitor changes the screen, and fires a resize.
    const onResize = () => setSmall(isSmall())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  if (!small || dismissed) return null
  return (
    <div className="small-screen panel">
      <p className="small-screen__text" role="status">
        {t('app.smallScreen')}
      </p>
      <Button size="sm" variant="solid" onClick={() => setDismissed(true)}>
        {t('app.smallScreenDismiss')}
      </Button>
    </div>
  )
}
