import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const OPTIONS = [
  { key: 'mat', p: 62 },
  { key: 'sofa', p: 18 },
  { key: 'floor', p: 11 },
  { key: 'moon', p: 1 },
] as const

export function Llm({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  const chosen = step >= 3
  return (
    <VisualShell id="llm">
      <div className="vz-llm">
        <p className="vz-llm__sentence">
          <span>{t('llm.sentence')}</span>
          {chosen && <span className="vz-chip vz-chip--lime">{t('llm.options.mat')}</span>}
          <span className="vz-llm__blank" aria-hidden="true" />
        </p>
        <ul className={`vz-bars vz-reveal${on(step >= 2)}${chosen ? ' is-dim' : ''}`}>
          {OPTIONS.map((option, index) => (
            <li key={option.key} className={`vz-bars__row${index === 0 ? ' is-top' : ''}`}>
              <span className="vz-bars__word">{t(`llm.options.${option.key}`)}</span>
              <span className="vz-bars__track">
                <span className="vz-bars__fill" style={{ width: `${option.p}%` }} />
              </span>
              <span className="vz-bars__value">{option.p}%</span>
            </li>
          ))}
        </ul>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('llm.again')}</p>
        <div className={`vz-inline vz-reveal${on(step >= 4)}`}>
          <span className="vz-chip">{t('llm.large')}</span>
          <span className="vz-chip">{t('llm.model')}</span>
        </div>
      </div>
    </VisualShell>
  )
}
