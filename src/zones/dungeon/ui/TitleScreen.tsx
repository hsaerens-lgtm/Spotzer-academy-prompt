import { useTranslation } from 'react-i18next'
import { getContent } from '../../../content/load'
import { appStore, useApp } from '../../../core/store'
import { listedMissionIds } from '../../../workshop/missionIndex'
import { AdaPortrait } from './AdaPortrait'
import { SoundToggle } from './SoundToggle'

/** Spec 3, §3.1: the title screen, with a warning when topics or workshop missions are left. */
export function TitleScreen() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.lang)
  const progress = useApp((s) => s.progress)
  const topics = getContent(lang).topics
  const missionIds = listedMissionIds(lang)
  const topicsLeft = topics.filter((topic) => !progress.topicsSeen.includes(topic.id)).length
  const missionsLeft = missionIds.filter((id) => !(progress.workshop?.passed ?? []).includes(id)).length
  const floor1Passed = progress.dungeon?.passed === true
  const { setDungeonRoute, requestZone } = appStore.getState()

  return (
    <section className="dg-title" aria-labelledby="dg-title-name">
      <div className="dg-title__corner">
        <SoundToggle />
      </div>
      <AdaPortrait />
      <h1 id="dg-title-name" className="dg-title__name">
        {t('dungeon.title')}
      </h1>
      <p className="dg-title__start" aria-hidden="true">
        {t('dungeon.pressStart')}
      </p>
      {topicsLeft > 0 || missionsLeft > 0 ? (
        <div className="dg-warning">
          <p>{t('dungeon.warning', { topics: topicsLeft, missions: missionsLeft })}</p>
          <div className="dg-actions">
            <button type="button" className="dg-btn" onClick={() => requestZone('office')}>
              {t('dungeon.goToOffice')}
            </button>
            <button type="button" className="dg-btn dg-btn--primary" onClick={() => setDungeonRoute({ floor: 1 })}>
              {t('dungeon.enterAnyway')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="dg-btn dg-btn--primary" onClick={() => setDungeonRoute({ floor: 1 })}>
          {t('dungeon.floor1')}
        </button>
      )}
      <div className="dg-floor2">
        <button
          type="button"
          className="dg-btn"
          disabled={!floor1Passed}
          aria-describedby={floor1Passed ? undefined : 'dg-floor2-locked'}
          onClick={() => setDungeonRoute({ floor: 2 })}
        >
          {t('dungeon.floor2')}
        </button>
        {!floor1Passed && (
          <p id="dg-floor2-locked" className="dg-note">
            {t('dungeon.floor2Locked')}
          </p>
        )}
      </div>
      <button type="button" className="dg-btn dg-btn--ghost" onClick={() => requestZone('office')}>
        <span aria-hidden="true">&larr; </span>
        {t('dungeon.back')}
      </button>
    </section>
  )
}
