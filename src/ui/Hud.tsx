import { useTranslation } from 'react-i18next'
import { languages, resolveLang } from '../core/i18n'
import { useContent } from '../core/selectors'
import { appStore, useApp } from '../core/store'
import { Button } from './Button'
import { Logo } from './Logo'
import './overlay.css'

export function Hud() {
  const { t } = useTranslation()
  const content = useContent()
  const seen = useApp((s) => s.progress.topicsSeen)
  const sound = useApp((s) => s.settings.sound)
  const lang = useApp((s) => s.settings.lang)
  const readingMode = useApp((s) => s.readingMode)
  const webglOk = useApp((s) => s.webgl === 'ok')
  const expandOpen = useApp((s) => s.expandOpen)
  const zone = useApp((s) => s.zone)
  // The keyboard way to the wall clock: only where the 3D office is on screen.
  const officeIn3D = useApp((s) => s.zone === 'office' && s.webgl === 'ok' && !s.readingMode)
  const { setSound, setLang, setReadingMode, advancePhase } = appStore.getState()
  const seenCount = content.topics.filter((topic) => seen.includes(topic.id)).length

  // The workshop's fake PC has its own taskbar (sound, back to the office).
  if (zone === 'workshop') return null

  return (
    <header className="hud panel" inert={expandOpen}>
      <div className="hud__brand">
        <Logo className="hud__logo" />
        <span className="hud__name">{t('app.name')}</span>
      </div>
      <div className="hud__tools">
        <span className="hud__progress" data-testid="progress">
          {t('hud.progress', { seen: seenCount, total: content.topics.length })}
        </span>
        {officeIn3D && (
          <Button size="sm" variant="solid" onClick={() => advancePhase()}>
            {t('hud.timeOfDay')}
          </Button>
        )}
        {webglOk && (
          <Button size="sm" variant="solid" onClick={() => setReadingMode(!readingMode)}>
            {readingMode ? t('hud.exitReadingMode') : t('hud.readingMode')}
          </Button>
        )}
        <Button size="sm" variant="solid" aria-pressed={sound} onClick={() => setSound(!sound)}>
          {sound ? t('hud.soundOn') : t('hud.soundOff')}
        </Button>
        <label className="hud__lang">
          <span className="sr-only">{t('hud.language')}</span>
          <select value={resolveLang(lang)} onChange={(event) => setLang(event.target.value)}>
            {languages.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  )
}
