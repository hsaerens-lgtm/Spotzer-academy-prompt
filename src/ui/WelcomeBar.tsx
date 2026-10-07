import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../core/store'
import { listedMissionIds } from '../workshop/missionIndex'
import { Button } from './Button'
import './overlay.css'

export function WelcomeBar() {
  const { t } = useTranslation()
  const firstVisit = useApp((s) => !s.progress.firstVisitDone)
  const hasScrolled = useApp((s) => s.hasScrolled)
  const missionIds = listedMissionIds(useApp((s) => s.settings.lang))
  // Spec 4.6: the saved id of a mission removed or renamed since is not counted.
  const missionsPassed = useApp((s) => (s.progress.workshop?.passed ?? []).filter((id) => missionIds.includes(id)).length)
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
            ? t('welcome.workshopProgress', { done: missionsPassed, total: missionIds.length })
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
