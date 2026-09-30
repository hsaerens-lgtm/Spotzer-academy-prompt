import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const LIGHTS = [
  { key: 'green', at: 1 },
  { key: 'orange', at: 2 },
  { key: 'red', at: 3 },
] as const

export function AiSafetyAtWork({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="ai-safety-at-work">
      <div className="vz-safety">
        {LIGHTS.map((light) => (
          <div key={light.key} className={`vz-safety__row vz-safety__row--${light.key} vz-reveal${on(step >= light.at)}`}>
            <span className="vz-safety__lamp" aria-hidden="true" />
            <div>
              <strong>{t(`ai-safety-at-work.${light.key}.title`)}</strong>
              <span>{t(`ai-safety-at-work.${light.key}.text`)}</span>
            </div>
          </div>
        ))}
        <p className={`vz-note vz-reveal${on(step >= 4)}`}>{t('ai-safety-at-work.verify')}</p>
      </div>
    </VisualShell>
  )
}
