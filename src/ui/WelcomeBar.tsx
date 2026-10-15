import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../core/store'
import { Button } from './Button'
import { DungeonDebrief } from './DungeonDebrief'
import './overlay.css'
import { useDungeonLabel } from './useDungeonLabel'
import { useWorkshopLabel } from './useWorkshopLabel'

export function WelcomeBar() {
  const { t } = useTranslation()
  const firstVisit = useApp((s) => !s.progress.firstVisitDone)
  const hasScrolled = useApp((s) => s.hasScrolled)
  const workshopLabel = useWorkshopLabel()
  const dungeonLabel = useDungeonLabel()
  const debrief = useApp((s) => s.dungeonDebrief !== null)
  const { openMenu, requestZone } = appStore.getState()
  return (
    <section className="welcome bottom-panel panel at-card at-card--raised" aria-label={t('app.name')}>
      {/* After a dungeon ejection, Ada's debrief takes the place of her greeting (spec 3, §4.5). */}
      {debrief ? (
        <DungeonDebrief />
      ) : (
        <p className="welcome__greeting">
          <span className="dialogue__speaker">{t('objects.ada')}</span>
          {t('welcome.greeting')}
        </p>
      )}
      {firstVisit && <p className="welcome__hint">{t('welcome.clickableHint')}</p>}
      <div className="welcome__actions">
        <Button variant="primary" onClick={openMenu}>
          {t('welcome.learn')} <span className="arr" aria-hidden="true">→</span>
        </Button>
        <Button variant="ghost" onClick={() => requestZone('workshop', 'laptop')}>
          {workshopLabel}
        </Button>
        <Button variant="ghost" onClick={() => requestZone('dungeon', 'tv')}>
          {dungeonLabel}
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
