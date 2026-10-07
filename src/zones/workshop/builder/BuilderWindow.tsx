import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../../core/store'
import { stabilityPercent, type BuildingInput } from '../../../workshop/building/plan'
import type { Phase } from '../../../workshop/building/timeline'
import { OUTCOME_FOR_TIER, type BlockType, type CoreBlock } from '../../../workshop/model'
import { BevelButton } from '../ui/BevelButton'
import { Window } from '../ui/Window'
import { Builder2D } from './Builder2D'
import { describeBuilding } from './describe'
import { SceneBoundary } from './SceneBoundary'

const BuilderScene3D = lazy(() => import('./BuilderScene3D'))

export interface BuilderWindowProps {
  className?: string
  input: BuildingInput | null
  runKey: number
  labels: Record<BlockType, string>
  /** The building was already seen to its end (its program was opened again): show its final state at once. */
  seen?: boolean
  /** What the window says before the first building; the missions' "after Build & test" by default. */
  emptyText?: string
  onDone?: (runKey: number) => void
  /** The 3D builder failed during this run: the plan view shows it instead. Called before the run's onDone. */
  onUnavailable?: (runKey: number) => void
  onBlockClick?: (block: CoreBlock) => void
  onReading?: (block: CoreBlock | null) => void
}

/**
 * One Build & test of one building: what a report, a failure or the outcome on screen belongs to. `serial` is the
 * key the scene reports with: unlike the parent's key, it differs for every run, even for a new building under a
 * reused key (two fix missions both start at attempt 0).
 */
interface Run {
  serial: number
  key: number
  input: BuildingInput
}

/** Only uniqueness matters: a serial skipped by a discarded render is harmless. */
let serials = 0

const band = (percent: number) => (percent >= 80 ? 'good' : percent >= 50 ? 'mid' : 'poor')

export function BuilderWindow({
  className,
  input,
  runKey,
  labels,
  seen = false,
  emptyText,
  onDone,
  onUnavailable,
  onBlockClick,
  onReading,
}: BuilderWindowProps) {
  const { t } = useTranslation()
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const reduced = useApp((s) => s.reducedMotion)
  const run = useMemo<Run | null>(() => (input ? { serial: ++serials, key: runKey, input } : null), [input, runKey])
  // A failing 3D builder leaves its run to the plan view; the next Build & test mounts it again (a fresh boundary).
  const [failedRun, setFailedRun] = useState<Run | null>(null)
  const [finishedRun, setFinishedRun] = useState<Run | null>(null)
  const [skippedRun, setSkippedRun] = useState<Run | null>(null)
  const [phase, setPhase] = useState<Phase>('placing')
  const [skipToken, setSkipToken] = useState(0)
  const [resetToken, setResetToken] = useState(0)
  const failed = run !== null && failedRun === run
  const use3D = threeD && !failed
  const latest = useRef(run)
  latest.current = run
  const reported = useRef<Run | null>(null)
  const resetButton = useRef<HTMLButtonElement>(null)

  // Only the current run may report, and only once: a building still falling from an earlier test is ignored.
  const finish = useCallback(
    (serial: number) => {
      const current = latest.current
      if (!current || serial !== current.serial || reported.current === current) return
      reported.current = current
      setFinishedRun(current)
      onDone?.(current.key)
    },
    [onDone],
  )
  // The plan view takes the run over; a run already done (its result already shown and announced) needs no word on it.
  const fail = () => {
    const current = latest.current
    setFailedRun(current)
    if (current && reported.current !== current) onUnavailable?.(current.key)
  }
  // Skip goes away when the run is done: if it had the focus, Reset view takes it rather than the page.
  const skipButton = useCallback((button: HTMLButtonElement | null) => {
    if (!button) return
    return () => {
      if (button.ownerDocument.activeElement === button) resetButton.current?.focus()
    }
  }, [])

  useEffect(() => {
    setPhase('placing')
  }, [run])
  // Nothing to wait for: the plan view, or the 3D builder under reduced motion or for a building already seen (it
  // jumps straight to the final state).
  useEffect(() => {
    if (run && (!use3D || reduced || seen)) finish(run.serial)
  }, [run, use3D, reduced, seen, finish])

  const done = run !== null && finishedRun === run
  const outcome = run ? OUTCOME_FOR_TIER[run.input.tier] : null
  const percent = run ? stabilityPercent(run.input) : 0

  return (
    <Window
      title={t('workshop.windows.builder')}
      variant="primary"
      className={className}
      tools={
        use3D && run ? (
          <>
            {/* Nothing to skip for a building already seen: it is shown at its end from the first frame. */}
            {!done && !seen && (
              <BevelButton
                ref={skipButton}
                size="sm"
                onClick={() => {
                  setSkipToken((n) => n + 1)
                  setSkippedRun(run)
                }}
              >
                {t('workshop.builder.skip')}
              </BevelButton>
            )}
            <BevelButton ref={resetButton} size="sm" onClick={() => setResetToken((n) => n + 1)}>
              {t('workshop.builder.resetView')}
            </BevelButton>
          </>
        ) : null
      }
    >
      <div className="ws-builder">
        {!run ? (
          <p className="ws-output__note">{emptyText ?? t('workshop.builder.empty')}</p>
        ) : use3D ? (
          <>
            {/* Not keyed by run: one canvas (one WebGL context) for every Build & test of this window. */}
            <SceneBoundary onError={fail}>
              <Suspense fallback={<p className="ws-output__note">{t('workshop.builder.loading')}</p>}>
                <BuilderScene3D
                  input={run.input}
                  runKey={run.serial}
                  skipToken={skipToken}
                  resetToken={resetToken}
                  // No replay of a run already seen to its end (back from reading mode, or in a program opened again),
                  // nor of a skipped one.
                  instant={reduced || seen || done || skippedRun === run}
                  aiLabel={t('workshop.builder.aiBlock')}
                  onPhase={setPhase}
                  onDone={finish}
                  onBlockClick={onBlockClick}
                  onReading={onReading}
                />
              </Suspense>
            </SceneBoundary>
            <p className="sr-only">{describeBuilding(run.input, labels, t)}</p>
          </>
        ) : (
          <>
            {failed && <p className="ws-output__note">{t('workshop.builder.unavailable')}</p>}
            <Builder2D input={run.input} labels={labels} onBlockClick={onBlockClick} />
          </>
        )}
        {run && (
          <div className="ws-builder__status">
            {done && outcome ? (
              <>
                <span className="ws-gauge" role="meter" aria-label={t('workshop.builder.stability')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                  <span className={`ws-gauge__fill ws-gauge__fill--${band(percent)}`} style={{ width: `${percent}%` }} />
                </span>
                <span className="ws-builder__outcome">{t(`workshop.builder.outcome.${outcome}`)}</span>
              </>
            ) : phase === 'reading' ? (
              <span className="ws-builder__reading">{t('workshop.builder.reading')}</span>
            ) : null}
          </div>
        )}
      </div>
    </Window>
  )
}
