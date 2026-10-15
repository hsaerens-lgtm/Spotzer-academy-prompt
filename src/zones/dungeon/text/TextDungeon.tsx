import { useTranslation } from 'react-i18next'
import { useDungeon, useDungeonStore } from '../store'

/**
 * Spec 3, §3.7: the dungeon without 3D. The maze shrinks to its main path: one line of description, then Continue
 * leads to the next guardian (or the boss). Same run, same rules.
 */
export function TextDungeon() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const run = useDungeon((s) => s.run)!
  const bossNext = run.defeated.every(Boolean)
  return (
    <section className="dg-text" aria-label={t('dungeon.title')}>
      <p className="dg-text__line">{t(bossNext ? 'dungeon.textBossRoom' : 'dungeon.textCorridor')}</p>
      {run.phase === 'exploring' && (
        <button type="button" className="dg-btn dg-btn--primary" autoFocus onClick={() => store.getState().dispatch({ type: 'advance' })}>
          {t('dungeon.continue')}
        </button>
      )}
    </section>
  )
}
