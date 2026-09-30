import { useProgress } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import { Logo } from '../ui/Logo'

export function LoadingScreen() {
  const { t } = useTranslation()
  const { active, progress } = useProgress()
  return (
    <div className="loading" role="status" aria-live="polite">
      <Logo className="loading__logo" />
      <p className="loading__text">{t('app.loading')}</p>
      <div className="loading__bar">
        <div
          className={`loading__fill${active ? '' : ' is-indeterminate'}`}
          style={active ? { width: `${Math.round(progress)}%` } : undefined}
        />
      </div>
    </div>
  )
}
