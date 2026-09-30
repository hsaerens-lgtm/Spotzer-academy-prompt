import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const PARTS = ['role', 'task', 'context', 'format'] as const

export function Prompt({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="prompt">
      <div className="vz-prompt">
        <div className="vz-card vz-prompt__card">
          {PARTS.map((part, index) => (
            <div
              key={part}
              className={`vz-prompt__row vz-reveal${on(step >= index + 1)}${step === index + 1 ? ' is-current' : ''}`}
            >
              <span className="vz-prompt__label">{t(`prompt.${part}.label`)}</span>
              <span className="vz-prompt__text">{t(`prompt.${part}.text`)}</span>
            </div>
          ))}
        </div>
        <p className={`vz-caption vz-reveal${on(step >= 4)}`}>{t('prompt.cta')}</p>
      </div>
    </VisualShell>
  )
}
