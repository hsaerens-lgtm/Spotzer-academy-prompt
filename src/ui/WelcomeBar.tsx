import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../core/store'
import { WORKSHOP_MISSION_COUNT } from '../workshop/model'
import { Button } from './Button'
import './overlay.css'

export function WelcomeBar() {
  const { t } = useTranslation()
  const firstVisit = useApp((s) => !s.progress.firstVisitDone)
  const hasScrolled = useApp((s) => s.hasScrolled)
  const missionsPassed = useApp((s) => s.progress.workshop?.passed.length ?? 0)
  const { openMenu, requestZone } = appStore.getState()
  return (
    <section className="welcome bottom-panel panel at-card at-card--raised" aria-label={t('app.name')}>
      <p className="welcome__greeting">
        <span className="dialogue__speaker">{t('objects.ada')}</span>
        {t('welcome.greeting')}
      </p>
      {firstVisit && <p className="welcome__hint">{t('welcome.clickableHint')}</p>}
      <div className="welcome__actions">
        <Button variant="primary" onClick={openMenu}>
          {t('welcome.learn')} <span className="arr" aria-hidden="true">→</span>
        </Button>
        <Button variant="ghost" onClick={() => requestZone('workshop', 'laptop')}>
          {missionsPassed > 0
            ? t('welcome.workshopProgress', { done: missionsPassed, total: WORKSHOP_MISSION_COUNT })
            : t('welcome.workshop')}
        </Button>
        <Button variant="ghost" onClick={() => requestZone('dungeon', 'tv')}>
          {t('welcome.dungeon')}
        </Button>
      </div>
      {firstVisit && !hasScrolled && (
        <p className="welcome__scroll" aria-hidden="true">
          {t('welcome.scrollHint')}
        </p>
      )}
    </section>
  )
}
