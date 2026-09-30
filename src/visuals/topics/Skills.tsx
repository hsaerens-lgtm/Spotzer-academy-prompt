import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const CARDS = ['voice', 'report', 'invoice'] as const

export function Skills({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="skills">
      <div className="vz-skills">
        <div className={`vz-inline vz-reveal${on(step >= 2)}`}>
          <span className="vz-label">{t('skills.taskLabel')}</span>
          <span className="vz-chip">{t('skills.task')}</span>
        </div>
        <div className="vz-skills__shelf">
          {CARDS.map((card) => (
            <div key={card} className={`vz-skills__card${step >= 2 && card === 'report' ? ' is-picked' : ''}`}>
              <span className="vz-skills__tab" aria-hidden="true" />
              <strong>{t(`skills.cards.${card}`)}</strong>
            </div>
          ))}
        </div>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('skills.caption')}</p>
      </div>
    </VisualShell>
  )
}
