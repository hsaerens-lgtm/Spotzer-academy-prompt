import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore } from '../../../core/store'
import { useDungeon, useDungeonStore } from '../store'
import { ReviewScreen } from './ReviewScreen'

/** Spec 3, §3.5: thrown out. Floor 1 goes back to the office (Ada's debrief waits there); floor 2 shows its corrections. */
export function GameOver() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const run = useDungeon((s) => s.run)!
  const back = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    back.current?.focus()
    store.getState().announce(`${t('dungeon.gameOver')}. ${t('dungeon.thrownOut')}`)
  }, [])

  const leave = () => {
    appStore.getState().setDungeonRoute({ floor: null })
    appStore.getState().requestZone('office')
  }

  return (
    <section className="dg-end dg-end--over" aria-labelledby="dg-over-title">
      <div className="dg-end__card">
        <h2 id="dg-over-title" className="dg-end__title">
          {t('dungeon.gameOver')}
        </h2>
        <p>{t('dungeon.thrownOut')}</p>
        <div className="dg-actions">
          <button ref={back} type="button" className="dg-btn dg-btn--primary" onClick={leave}>
            {t('dungeon.back')}
          </button>
          {run.floor === 2 && (
            <button type="button" className="dg-btn" onClick={() => store.getState().start(2)}>
              {t('dungeon.tryAgain')}
            </button>
          )}
        </div>
        {run.floor === 2 && <ReviewScreen />}
      </div>
    </section>
  )
}
