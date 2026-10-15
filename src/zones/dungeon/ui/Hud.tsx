import { useTranslation } from 'react-i18next'
import { RULES } from '../../../dungeon/score'
import { useDungeon, useDungeonStore } from '../store'
import { SoundToggle } from './SoundToggle'

/** Hearts, guardians beaten and the pause button (spec 3, §3.2). */
export function Hud() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const run = useDungeon((s) => s.run)!
  const done = run.defeated.filter(Boolean).length
  return (
    <header className="dg-hud">
      <p className="dg-hearts" role="img" aria-label={t('dungeon.hearts', { count: run.hearts })}>
        {Array.from({ length: RULES[run.floor].hearts }, (_, i) => (
          <span key={i} className={`dg-heart${i < run.hearts ? '' : ' is-lost'}`} />
        ))}
      </p>
      <p className="dg-counter">{t('dungeon.guardians', { done, total: run.defeated.length })}</p>
      <SoundToggle />
      <button type="button" className="dg-btn dg-btn--small" onClick={() => store.getState().setPaused(true)}>
        {t('dungeon.pause')}
      </button>
    </header>
  )
}
