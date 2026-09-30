import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

export function Tools({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="tools">
      <div className="vz-tools">
        <div className="vz-chat">
          <p className="vz-bubble vz-bubble--user">{t('tools.question')}</p>
          <p className="vz-bubble vz-bubble--ai">{t('tools.thinking')}</p>
          <p className={`vz-bubble vz-bubble--ai vz-reveal${on(step >= 3)}`}>{t('tools.answer')}</p>
        </div>
        <div className={`vz-tools__side vz-reveal${on(step >= 2)}`}>
          <code className="vz-tools__call">{t('tools.call')}</code>
          <div className="vz-card vz-tools__tool">
            <span className="vz-label">{t('tools.toolLabel')}</span>
            <strong>{t('tools.toolName')}</strong>
            <span className={`vz-tools__result vz-reveal${on(step >= 3)}`}>{t('tools.result')}</span>
          </div>
        </div>
      </div>
    </VisualShell>
  )
}
