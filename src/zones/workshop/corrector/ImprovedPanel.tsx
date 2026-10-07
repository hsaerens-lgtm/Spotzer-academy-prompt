import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { diffWords } from '../../../workshop/diff'
import type { CorrectorReport } from '../../../workshop/model'
import { CopyFallbackField } from '../CopyFallbackField'
import { useCopyWithFallback } from '../copy'
import type { RunState } from '../store'
import { BevelButton } from '../ui/BevelButton'
import { Window } from '../ui/Window'

export interface ImprovedPanelProps {
  className?: string
  report: CorrectorReport | null
  /** The report's building is shown: until then the panel waits with it. */
  revealed: boolean
  checkedPrompt: string | null
  /** The prompt was edited since the check: "Run both" would run the old text, so it waits for a new check. */
  stale: boolean
  /** A check is on its way: "Run both" waits for it. */
  checking: boolean
  run: RunState
  onRun: () => void
}

export function ImprovedPanel({ className, report, revealed, checkedPrompt, stale, checking, run, onRun }: ImprovedPanelProps) {
  const { t } = useTranslation()
  const clipboard = useCopyWithFallback()
  const { reset } = clipboard
  // A new report is a new text to copy: "Copied" and the fallback field belonged to the previous one.
  useEffect(() => reset(), [report, reset])

  return (
    <Window title={t('workshop.windows.output')} className={className}>
      {!report ? (
        <p className="ws-output__note">{t('workshop.corrector.intro')}</p>
      ) : !revealed ? (
        <p className="ws-output__note">{t('workshop.output.reading')}</p>
      ) : (
        <>
          <h3 className="ws-compare__title">{t('workshop.corrector.improved')}</h3>
          <p className="ws-improved">
            {diffWords(checkedPrompt ?? '', report.improvedPrompt).map((part, index) =>
              part.added ? <ins key={index}>{part.text}</ins> : <span key={index}>{part.text}</span>,
            )}
          </p>
          {clipboard.fallback !== null && <CopyFallbackField text={clipboard.fallback} selectRef={clipboard.selectFallback} rows={4} />}
          <div className="ws-studio__actions">
            <BevelButton onClick={() => void clipboard.copy(report.improvedPrompt)}>
              {clipboard.copied ? t('workshop.corrector.copied') : t('workshop.corrector.copy')}
            </BevelButton>
            {!stale && (
              <BevelButton tone="primary" disabled={run.status === 'running' || checking} onClick={onRun}>
                {t('workshop.corrector.runBoth')}
              </BevelButton>
            )}
          </div>
          {stale && <p className="ws-stale">{t('workshop.corrector.stale')}</p>}
          {report.changes.length > 0 && (
            <>
              <h3 className="ws-compare__title">{t('workshop.corrector.changes')}</h3>
              <ul className="ws-changes">
                {report.changes.map((change, index) => (
                  <li key={index}>{change}</li>
                ))}
              </ul>
            </>
          )}
          {run.status === 'running' && <p className="ws-output__note">{t('workshop.corrector.running')}</p>}
          {run.status === 'error' && run.error && <p className="ws-error">{t(`workshop.corrector.errors.${run.error}`)}</p>}
          {run.status === 'done' && (
            <div className="ws-compare">
              <section className="ws-compare__side">
                <h3 className="ws-compare__title">{t('workshop.corrector.yours')}</h3>
                <p className="ws-answer__text">{run.original}</p>
              </section>
              <section className="ws-compare__side">
                <h3 className="ws-compare__title">{t('workshop.corrector.improvedAnswer')}</h3>
                <p className="ws-answer__text">{run.improved}</p>
              </section>
            </div>
          )}
        </>
      )}
    </Window>
  )
}
