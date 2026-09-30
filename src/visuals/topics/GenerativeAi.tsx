import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

function PhotoGlyph({ withPaper = false }: { withPaper?: boolean }) {
  return (
    <svg className="vz-photo" viewBox="0 0 160 120" aria-hidden="true">
      <rect x="2" y="2" width="156" height="116" rx="14" className="vz-photo__frame" />
      <path d="M52 92 Q80 44 108 92 Z" className="vz-photo__cat" />
      <circle cx="80" cy="52" r="18" className="vz-photo__cat" />
      <path d="M66 42 L69 26 L76 37 Z M94 42 L91 26 L84 37 Z" className="vz-photo__cat" />
      {withPaper && <rect x="56" y="64" width="48" height="30" rx="3" className="vz-photo__paper" />}
    </svg>
  )
}

export function GenerativeAi({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="generative-ai">
      <div className="vz-gen">
        <div className={`vz-card vz-reveal${on(step >= 1)}`}>
          <p className="vz-label">{t('generative-ai.classic')}</p>
          <div className="vz-gen__io">
            <PhotoGlyph />
            <span className="vz-arrow" aria-hidden="true">→</span>
            <span className="vz-chip">{t('generative-ai.classicLabel')}</span>
          </div>
        </div>
        <div className={`vz-card vz-gen__card--new vz-reveal${on(step >= 2)}`}>
          <p className="vz-label">{t('generative-ai.gen')}</p>
          <div className="vz-gen__io">
            <span className="vz-chip">{t('generative-ai.prompt')}</span>
            <span className="vz-arrow" aria-hidden="true">→</span>
            <PhotoGlyph withPaper />
          </div>
        </div>
        <p className={`vz-caption vz-gen__caption vz-reveal${on(step >= 3)}`}>{t('generative-ai.caption')}</p>
      </div>
    </VisualShell>
  )
}
