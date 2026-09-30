import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const NODES = [
  { key: 'plan', x: 50, y: 10 },
  { key: 'act', x: 84, y: 50 },
  { key: 'observe', x: 50, y: 90 },
  { key: 'repeat', x: 16, y: 50 },
] as const

export function Agents({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="agents">
      <div className="vz-agents">
        <svg className="vz-agents__ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="50" cy="50" rx="34" ry="40" />
        </svg>
        <div className="vz-agents__goal">
          <span className="vz-label">{t('agents.goalLabel')}</span>
          <strong>{t('agents.goal')}</strong>
        </div>
        {NODES.map((node, index) => (
          <div key={node.key} className="vz-agents__node" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
            <div className={`vz-reveal${on(step >= index + 1)}`}>
              <div className={`vz-agents__card${step === index + 1 ? ' is-current' : ''}`}>
                <strong>{t(`agents.${node.key}.name`)}</strong>
                <span>{t(`agents.${node.key}.text`)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </VisualShell>
  )
}
