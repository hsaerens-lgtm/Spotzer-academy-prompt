import { useTranslation } from 'react-i18next'
import type { WorkshopView } from '../store'
import { VIEWS } from './Taskbar'

export function DesktopIcons({ onOpen }: { onOpen: (view: WorkshopView) => void }) {
  const { t } = useTranslation()
  return (
    <div className="ws-icons" role="group" aria-label={t('workshop.desktop.label')}>
      {VIEWS.map((view) => (
        <button key={view} type="button" className={`ws-icon ws-icon--${view}`} onClick={() => onOpen(view)}>
          <span className="ws-icon__art" aria-hidden="true" />
          <span className="ws-icon__label">{t(`workshop.desktop.${view}`)}</span>
        </button>
      ))}
    </div>
  )
}
