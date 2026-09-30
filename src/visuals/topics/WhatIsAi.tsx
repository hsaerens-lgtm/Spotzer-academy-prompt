import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const RINGS = [
  { key: 'ai', r: 230, at: 1 },
  { key: 'ml', r: 172, at: 2 },
  { key: 'dl', r: 114, at: 3 },
  { key: 'gen', r: 56, at: 4 },
] as const

export function WhatIsAi({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="what-is-ai">
      <div className="vz-row">
        <svg className="vz-rings" viewBox="-240 -240 480 480" aria-hidden="true">
          {RINGS.map((ring) => (
            <circle
              key={ring.key}
              r={ring.r}
              className={`vz-ring vz-ring--${ring.key}${on(step >= ring.at)}${step === ring.at ? ' is-current' : ''}`}
            />
          ))}
        </svg>
        <ol className="vz-legend">
          {RINGS.map((ring) => (
            <li
              key={ring.key}
              className={`vz-legend__item vz-reveal${on(step >= ring.at)}${step === ring.at ? ' is-current' : ''}`}
            >
              <strong>{t(`what-is-ai.${ring.key}.name`)}</strong>
              <span>{t(`what-is-ai.${ring.key}.text`)}</span>
            </li>
          ))}
        </ol>
      </div>
    </VisualShell>
  )
}
