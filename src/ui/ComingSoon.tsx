import { useTranslation } from 'react-i18next'
import { useApp } from '../core/store'
import { Button } from './Button'

export function ComingSoon({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation()
  const requestZone = useApp((s) => s.requestZone)
  return (
    <section className="coming-soon panel" aria-labelledby="coming-soon-title">
      <div className="coming-soon__card at-card at-card--raised">
        <p className="at-kicker">{t('app.name')}</p>
        <h1 id="coming-soon-title" className="at-h1">
          {title}
        </h1>
        <p className="at-script coming-soon__script">{t('zones.soonLabel')}</p>
        <p className="at-lede">{body}</p>
        <Button variant="primary" onClick={() => requestZone('office')}>
          {t('zones.back')} <span className="arr" aria-hidden="true">→</span>
        </Button>
      </div>
    </section>
  )
}
