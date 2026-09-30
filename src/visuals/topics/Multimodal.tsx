import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const INPUTS = ['text', 'image', 'audio'] as const
const OUTPUTS = ['text', 'image', 'speech'] as const

export function Multimodal({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="multimodal">
      <div className="vz-mm">
        <ul className={`vz-mm__col vz-reveal${on(step >= 1)}`}>
          {INPUTS.map((key) => (
            <li key={key} className="vz-chip">
              {t(`multimodal.in.${key}`)}
            </li>
          ))}
        </ul>
        <div className={`vz-mm__center vz-reveal${on(step >= 2)}`}>
          <span className="vz-arrow" aria-hidden="true">→</span>
          <span className="vz-mm__model">{t('multimodal.model')}</span>
          <span className="vz-arrow" aria-hidden="true">→</span>
        </div>
        <ul className={`vz-mm__col vz-reveal${on(step >= 3)}`}>
          {OUTPUTS.map((key) => (
            <li key={key} className="vz-chip">
              {t(`multimodal.out.${key}`)}
            </li>
          ))}
        </ul>
        <p className={`vz-caption vz-mm__caption vz-reveal${on(step >= 3)}`}>{t('multimodal.caption')}</p>
      </div>
    </VisualShell>
  )
}
