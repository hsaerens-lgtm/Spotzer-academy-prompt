import { useTranslation } from 'react-i18next'
import { useScreenRef } from '../core/selectors'
import { useApp } from '../core/store'
import { Button } from '../ui/Button'
import { DialogueBox } from '../ui/DialogueBox'
import { ExpandOverlay } from '../ui/ExpandOverlay'
import { TopicMenu } from '../ui/TopicMenu'
import { useWorkshopLabel } from '../ui/useWorkshopLabel'
import { FitScreen } from '../visuals/FitScreen'
import { ScreenContent } from '../visuals/ScreenContent'
import './reading.css'

export function ReadingMode() {
  const { t } = useTranslation()
  const activeTopic = useApp((s) => s.activeTopic)
  const webglLost = useApp((s) => s.webglLost)
  const expandOpen = useApp((s) => s.expandOpen)
  const requestZone = useApp((s) => s.requestZone)
  const workshopLabel = useWorkshopLabel()
  const screen = useScreenRef()

  return (
    <>
      <main className="reading panel" aria-label={t('hud.readingMode')}>
        {webglLost && (
          <p className="reading__banner" role="status">
            {t('errors.webglLost')}
          </p>
        )}
        <div className="reading__grid">
          <aside className="reading__side">
            <TopicMenu embedded />
            <div className="reading__zones">
              <Button variant="ghost" onClick={() => requestZone('workshop')}>
                {workshopLabel}
              </Button>
              <Button variant="ghost" onClick={() => requestZone('dungeon')}>
                {t('welcome.dungeon')}
              </Button>
            </div>
            {/* CC BY 4.0: the credit of the office's attributed 3D models (public/assets/CREDITS.md lists every file). */}
            <p className="reading__credits">{t('credits.models')}</p>
          </aside>
          <section className="reading__main">
            {activeTopic ? (
              <>
                <div className="reading__screen">
                  <FitScreen>
                    <ScreenContent screen={screen} />
                  </FitScreen>
                </div>
                <DialogueBox />
              </>
            ) : (
              <div className="reading__intro at-card">
                <p className="welcome__greeting">
                  <span className="dialogue__speaker">{t('objects.ada')}</span>
                  {t('welcome.greeting')}
                </p>
                <p className="welcome__hint">{t('welcome.pickTopic')}</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {/* Outside <main>: positioned against .overlay like in the 3D office, not inside the scrolling reading area. */}
      {activeTopic && expandOpen && <ExpandOverlay />}
    </>
  )
}
