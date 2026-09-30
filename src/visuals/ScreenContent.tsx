import { useTranslation } from 'react-i18next'
import type { ScreenRef } from '../content/schema'
import { Logo } from '../ui/Logo'
import { isVisualId } from './manifest'
import { visualComponents } from './registry'
import './visuals.css'

function IdleScreen() {
  const { t } = useTranslation('visuals')
  return (
    <div className="vz-idle">
      <Logo className="vz-idle__logo" />
      <p className="at-kicker">{t('idle.kicker')}</p>
      <h2 className="vz-idle__title">{t('idle.title')}</h2>
      <p className="at-script vz-idle__tagline">{t('idle.tagline')}</p>
    </div>
  )
}

export function ScreenContent({ screen }: { screen: ScreenRef | null }) {
  const { t } = useTranslation('visuals')
  const Visual = screen && isVisualId(screen.visualId) ? visualComponents[screen.visualId] : undefined
  return (
    <div className="screen-root" data-testid="screen-content">
      {Visual && screen ? (
        <>
          <Visual step={screen.step} />
          <p className="sr-only">{t(`${screen.visualId}.description`)}</p>
        </>
      ) : (
        <IdleScreen />
      )}
    </div>
  )
}
