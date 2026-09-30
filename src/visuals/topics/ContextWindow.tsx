import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const MESSAGE_COUNT = 8
const ROW = 68 // 56 px message + 12 px gap
const FRAME_TOP = 210

export function ContextWindow({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  const shifted = step >= 2
  const shown = shifted ? MESSAGE_COUNT : 4
  const firstInside = shifted ? 4 : 0
  return (
    <VisualShell id="context-window">
      <div className="vz-row">
        <div className="vz-ctx">
          <ol className="vz-ctx__list" style={{ transform: `translateY(${shifted ? FRAME_TOP - 4 * ROW : FRAME_TOP}px)` }}>
            {Array.from({ length: shown }, (_, index) => (
              <li
                key={index}
                className={`vz-ctx__msg vz-ctx__msg--${index % 2 === 0 ? 'user' : 'ai'}${index < firstInside ? ' is-out' : ''}`}
              >
                {t(`context-window.messages.${index}`)}
              </li>
            ))}
          </ol>
          <div className="vz-ctx__frame" aria-hidden="true">
            <span className="vz-ctx__frame-label">{t('context-window.window')}</span>
          </div>
        </div>
        <div className="vz-ctx__side">
          <p className={`vz-ctx__out vz-reveal${on(step >= 2)}`}>{t('context-window.forgotten')}</p>
          <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('context-window.caption')}</p>
          <p className={`vz-note vz-reveal${on(step >= 3)}`}>{t('context-window.tip')}</p>
        </div>
      </div>
    </VisualShell>
  )
}
