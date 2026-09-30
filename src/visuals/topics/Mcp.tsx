import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const TOOLS = ['drive', 'calendar', 'crm', 'database'] as const

export function Mcp({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  const unified = step >= 2
  return (
    <VisualShell id="mcp">
      <div className="vz-mcp">
        <p className="vz-label">{unified ? t('mcp.after') : t('mcp.before')}</p>
        <div className="vz-mcp__diagram">
          <div className="vz-mcp__ai">{t('mcp.ai')}</div>
          <div className={`vz-mcp__links${unified ? ' is-unified' : ''}`}>
            {unified ? (
              <span className="vz-mcp__port">{t('mcp.port')}</span>
            ) : (
              TOOLS.map((tool) => (
                <span key={tool} className="vz-mcp__custom">
                  {t('mcp.custom')}
                </span>
              ))
            )}
          </div>
          <ul className="vz-mcp__tools">
            {TOOLS.map((tool) => (
              <li key={tool} className="vz-chip">
                {t(`mcp.tools.${tool}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('mcp.caption')}</p>
      </div>
    </VisualShell>
  )
}
