import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const CHECKS = ['sources', 'facts', 'dontKnow'] as const

export function Hallucinations({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="hallucinations">
      <div className="vz-row">
        <div className="vz-chat">
          <p className="vz-bubble vz-bubble--user">{t('hallucinations.question')}</p>
          <p className={`vz-bubble vz-bubble--ai vz-reveal${on(step >= 2)}`}>
            {t('hallucinations.answer')}
            <span className="vz-hallu__tag">{t('hallucinations.tag')}</span>
          </p>
          <div className={`vz-hallu__stamp-wrap vz-reveal${on(step >= 3)}`}>
            <span className="vz-hallu__stamp">{t('hallucinations.stamp')}</span>
          </div>
        </div>
        <ul className={`vz-checklist vz-reveal${on(step >= 3)}`}>
          {CHECKS.map((key) => (
            <li key={key}>{t(`hallucinations.check.${key}`)}</li>
          ))}
        </ul>
      </div>
    </VisualShell>
  )
}
