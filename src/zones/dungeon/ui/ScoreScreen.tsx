import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../../../core/store'
import { useDungeon, useDungeonStore } from '../store'
import { CertificateForm } from './CertificateForm'
import { ReviewScreen } from './ReviewScreen'

/** Spec 3, §3.5: the score, the best score, the way down to The Deep and, on floor 2, the corrections. */
export function ScoreScreen() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const run = useDungeon((s) => s.run)!
  const result = useApp((s) => (run.floor === 1 ? s.progress.dungeon : s.progress.dungeon?.expert))
  // Spec 3, §3.9: the certificate carries the best pass and its date (this run's, unless an earlier one scored higher).
  const best = result?.bestScore ?? run.score
  const date = result?.passedAt ?? new Date().toISOString().slice(0, 10)
  const right = run.answers.filter((a) => a.correct).length
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
    store.getState().announce(`${t('dungeon.victory')} ${t('dungeon.score', { score: run.score })}`)
  }, [])

  return (
    <section className="dg-end" aria-labelledby="dg-end-title">
      <div className="dg-end__card">
        <h2 id="dg-end-title" ref={heading} tabIndex={-1} className="dg-end__title">
          {t('dungeon.victory')}
        </h2>
        <p className="dg-score">{t('dungeon.score', { score: run.score })}</p>
        <p className="dg-note">{t('dungeon.best', { best })}</p>
        <p className="dg-note">{t('dungeon.details', { right, total: run.defeated.length, attempts: run.boss.length })}</p>
        <div className="dg-actions">
          {run.floor === 1 && (
            <button type="button" className="dg-btn dg-btn--primary" onClick={() => appStore.getState().setDungeonRoute({ floor: 2 })}>
              {t('dungeon.goDown')}
            </button>
          )}
          <button type="button" className="dg-btn" onClick={() => appStore.getState().setDungeonRoute({ floor: null })}>
            {t('dungeon.toTitle')}
          </button>
        </div>
        <CertificateForm floor={run.floor} score={best} date={date} />
        {run.floor === 2 && <ReviewScreen />}
      </div>
    </section>
  )
}
