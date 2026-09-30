import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VisualId } from './manifest'
import './visuals.css'

export interface VisualProps {
  step: number
}

export const on = (active: boolean) => (active ? ' is-on' : '')

export function VisualShell({ id, children }: { id: VisualId; children: ReactNode }) {
  const { t } = useTranslation('visuals')
  return (
    <div className={`vz vz--${id}`}>
      <header className="vz__head">
        <p className="at-kicker">{t(`${id}.kicker`)}</p>
        <h3 className="vz__title at-script">{t(`${id}.title`)}</h3>
      </header>
      <div className="vz__body">{children}</div>
    </div>
  )
}
