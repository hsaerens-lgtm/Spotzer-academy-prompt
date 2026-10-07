import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { inputFromReport, type BuildingInput } from '../../../workshop/building/plan'
import { MAX_CORRECT_PROMPT, MAX_PURPOSE, OUTCOME_FOR_TIER } from '../../../workshop/model'
import { AdaBubble } from '../ada/AdaBubble'
import { isSubmitShortcut } from '../keys'
import { useWorkshop, useWorkshopStore } from '../store'
import { BevelButton } from '../ui/BevelButton'
import { Window } from '../ui/Window'
import { ImprovedPanel, runErrorKey } from './ImprovedPanel'
import { Report } from './Report'
import { useFocusReturn } from './useFocusReturn'

export interface CorrectorBuilderProps {
  input: BuildingInput | null
  runKey: number
  /**
   * The report is revealed: its building was seen to its end, perhaps before this view was last opened. The builder
   * then shows the final state without a replay.
   */
  seen: boolean
  /** The builder's text before the first check. */
  emptyText: string
  onDone: (runKey: number) => void
}

export function CorrectorView({ renderBuilder }: { renderBuilder: (props: CorrectorBuilderProps) => ReactNode }) {
  const { t } = useTranslation()
  const store = useWorkshopStore()
  const content = useWorkshop((s) => s.content)
  const state = useWorkshop((s) => s.corrector)
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    void store.getState().checkHealth()
  }, [store])

  const input = useMemo(() => (state.report ? inputFromReport(state.report) : null), [state.report])
  // In the store, not in this view: the view is unmounted while another program is open.
  const revealed = state.report !== null && state.revealedCheck === state.checks
  // The report is about the text that was checked: once the prompt is edited it no longer describes it.
  const stale = state.report !== null && state.checkedPrompt !== state.prompt.trim()
  // Only the building of the latest report may reveal it (the store ignores one finishing for an older report).
  const onDone = useCallback((key: number) => store.getState().revealReport(key), [store])
  const checking = state.status === 'checking'
  const blank = state.prompt.trim() === ''
  const checkFocus = useFocusReturn(checking)
  const check = () => {
    // A closed bubble comes back with the next result.
    setDismissed(null)
    checkFocus.remember()
    void store.getState().checkPrompt()
  }

  // One announcement per report, when its building is shown (keyed on that only: the rest follows from it), and one
  // per failed check and per Run both outcome, as they happen (Ada's bubble is not a live region).
  // The refs skip what the store already held when the view opened: that was announced at the time.
  const lastRevealed = useRef(revealed)
  useEffect(() => {
    if (lastRevealed.current === revealed) return
    lastRevealed.current = revealed
    if (!revealed || !state.report || !input) return
    const { score, summary } = state.report
    store.getState().announce(`${t('workshop.corrector.score', { score })}. ${t(`workshop.corrector.verdict.${OUTCOME_FOR_TIER[input.tier]}`)}. ${summary}`)
  }, [revealed])

  const lastStatus = useRef(state.status)
  useEffect(() => {
    if (lastStatus.current === state.status) return
    lastStatus.current = state.status
    if (state.status === 'error' && state.error) store.getState().announce(t(`workshop.corrector.errors.${state.error}`))
  }, [state.status])
  const lastRun = useRef(state.run)
  useEffect(() => {
    if (lastRun.current === state.run) return
    lastRun.current = state.run
    const { status, error } = state.run
    if (status === 'done') store.getState().announce(t('workshop.corrector.ran'))
    else if (status === 'error' && error) store.getState().announce(t(runErrorKey(error)))
  }, [state.run])

  const adaText =
    state.health === 'offline'
      ? `${t('workshop.corrector.offline')} ${t('workshop.corrector.offlineHelp')}`
      : checking
        ? t('workshop.corrector.checking')
        : state.status === 'error' && state.error
          ? t(`workshop.corrector.errors.${state.error}`)
          : state.report && !revealed
            ? t('workshop.output.reading')
            : state.report
              ? state.report.summary
              : t('workshop.corrector.intro')

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!isSubmitShortcut(event)) return
    event.preventDefault()
    if (!blank && !checking) check()
  }

  return (
    <>
      <Window title={t('workshop.windows.corrector')} variant="primary" className="ws-area-main">
        {state.health === 'offline' ? (
          <div className="ws-offline">
            <p className="ws-offline__title">{t('workshop.corrector.offline')}</p>
            <p>{t('workshop.corrector.offlineHelp')}</p>
          </div>
        ) : (
          <>
            <p className="ws-warning">{t('workshop.corrector.warning')}</p>
            <label className="ws-free">
              <span className="ws-free__label">{t('workshop.corrector.promptLabel')}</span>
              <textarea
                className="ws-field"
                rows={8}
                maxLength={MAX_CORRECT_PROMPT}
                value={state.prompt}
                onChange={(event) => store.getState().setCorrectorPrompt(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </label>
            <p className="ws-count">{t('workshop.corrector.count', { count: state.prompt.length, max: MAX_CORRECT_PROMPT })}</p>
            <label className="ws-free">
              <span className="ws-free__label">{t('workshop.corrector.purposeLabel')}</span>
              <input
                className="ws-field"
                maxLength={MAX_PURPOSE}
                value={state.purpose}
                onChange={(event) => store.getState().setCorrectorPurpose(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </label>
            <div className="ws-studio__actions">
              <BevelButton ref={checkFocus.button} tone="primary" disabled={blank || checking} aria-keyshortcuts="Control+Enter" onClick={check}>
                {state.status === 'error' ? t('workshop.corrector.tryAgain') : t('workshop.corrector.check')}
              </BevelButton>
            </div>
            {checking && <p className="ws-output__note">{t('workshop.corrector.checking')}</p>}
            {/* A failed check comes first: the report below it, if any, is the previous one. */}
            {state.status === 'error' && state.error && <p className="ws-error">{t(`workshop.corrector.errors.${state.error}`)}</p>}
            {state.report && input && revealed && (
              <>
                {stale && <p className="ws-stale">{t('workshop.corrector.stale')}</p>}
                <Report report={state.report} building={input} labels={content.labels} />
              </>
            )}
          </>
        )}
      </Window>
      {renderBuilder({
        input,
        runKey: state.checks,
        seen: revealed,
        // Offline there is no Check my prompt button to point at.
        emptyText: t(state.health === 'offline' ? 'workshop.corrector.builderOffline' : 'workshop.corrector.builderEmpty'),
        onDone,
      })}
      <ImprovedPanel
        className="ws-area-output"
        offline={state.health === 'offline'}
        report={state.report}
        revealed={revealed}
        checkedPrompt={state.checkedPrompt}
        stale={stale}
        checking={checking}
        run={state.run}
        onRun={() => void store.getState().runBoth()}
      />
      <AdaBubble
        text={adaText === dismissed ? null : adaText}
        mood={state.status === 'error' || state.health === 'offline' ? 'surprised' : checking ? 'thinking' : 'happy'}
        pointing={revealed}
        onDismiss={() => setDismissed(adaText)}
      />
    </>
  )
}
