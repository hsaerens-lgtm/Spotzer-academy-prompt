import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore } from '../../../core/store'
import { useDungeon, useDungeonStore } from '../store'

/** Escape while exploring, or the HUD's Pause button. Leaving asks first: the run would be lost (spec 3, §3.1). */
export function PauseMenu() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const paused = useDungeon((s) => s.paused)
  const exploring = useDungeon((s) => s.run?.phase === 'exploring')
  const [leaving, setLeaving] = useState<'title' | 'office' | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (!exploring && !paused)) return
      event.preventDefault()
      setLeaving(null)
      store.getState().setPaused(!store.getState().paused)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exploring, paused, store])

  if (!paused) return null
  const leave = () => {
    store.getState().setPaused(false)
    appStore.getState().setDungeonRoute({ floor: null })
    if (leaving === 'office') appStore.getState().requestZone('office')
  }
  return (
    <div className="dg-pause" role="dialog" aria-labelledby="dg-pause-title">
      <div className="dg-end__card">
        <h2 id="dg-pause-title" className="dg-end__title">
          {t('dungeon.pause')}
        </h2>
        {leaving ? (
          <>
            <p>{t('dungeon.leaveConfirm')}</p>
            <div className="dg-actions">
              <button type="button" className="dg-btn dg-btn--primary" autoFocus onClick={leave}>
                {t('dungeon.leave')}
              </button>
              <button type="button" className="dg-btn" onClick={() => setLeaving(null)}>
                {t('dungeon.stay')}
              </button>
            </div>
          </>
        ) : (
          <div className="dg-actions dg-actions--column">
            <button type="button" className="dg-btn dg-btn--primary" autoFocus onClick={() => store.getState().setPaused(false)}>
              {t('dungeon.resume')}
            </button>
            <button type="button" className="dg-btn" onClick={() => setLeaving('title')}>
              {t('dungeon.toTitle')}
            </button>
            <button type="button" className="dg-btn" onClick={() => setLeaving('office')}>
              {t('dungeon.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
