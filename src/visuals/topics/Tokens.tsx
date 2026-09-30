import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

/** English sample shown in every language: the split below belongs to this exact sentence. */
export const SAMPLE_TEXT = 'Prompting is a skill you can learn.'
/** o200k_base split of SAMPLE_TEXT, checked against the real tokenizer in visuals.test.tsx. */
export const SAMPLE_TOKENS = ['Prompt', 'ing', ' is', ' a', ' skill', ' you', ' can', ' learn', '.'] as const

const WHY = ['cost', 'speed', 'memory'] as const

export function Tokens({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="tokens">
      <div className="vz-tokens">
        <p className="vz-tokens__sentence">
          {step >= 2
            ? SAMPLE_TOKENS.map((token, index) => (
                <span key={index} className={`vz-token vz-token--${index % 2}`}>
                  {token}
                </span>
              ))
            : SAMPLE_TEXT}
        </p>
        <p className={`vz-tokens__count vz-reveal${on(step >= 3)}`}>
          {t('tokens.count', { tokens: SAMPLE_TOKENS.length, chars: SAMPLE_TEXT.length })}
        </p>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('tokens.rule')}</p>
        <div className={`vz-inline vz-reveal${on(step >= 4)}`}>
          <span className="vz-label">{t('tokens.why.title')}</span>
          {WHY.map((key) => (
            <span key={key} className="vz-chip">
              {t(`tokens.why.${key}`)}
            </span>
          ))}
        </div>
      </div>
    </VisualShell>
  )
}
