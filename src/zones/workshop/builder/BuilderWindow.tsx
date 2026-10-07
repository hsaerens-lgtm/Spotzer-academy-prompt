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
  onDone?: (runKey: number) => void
  onBlockClick?: (block: CoreBlock) => void
  onReading?: (block: CoreBlock | null) => void
}

/** One Build & test of one building: what a report, a failure or the outcome on screen belongs to. */
interface Run {
  key: number
  input: BuildingInput
}

const band = (percent: number) => (percent >= 80 ? 'good' : percent >= 50 ? 'mid' : 'poor')

export function BuilderWindow({ className, input, runKey, labels, onDone, onBlockClick, onReading }: BuilderWindowProps) {
  const { t } = useTranslation()
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const reduced = useApp((s) => s.reducedMotion)
  const run = useMemo<Run | null>(() => (input ? { key: runKey, input } : null), [input, runKey])
  // A failing 3D builder leaves its run to the plan view; the next Build & test mounts it again (a fresh boundary).
  const [failedRun, setFailedRun] = useState<Run | null>(null)
  const [finishedRun, setFinishedRun] = useState<Run | null>(null)
  const [phase, setPhase] = useState<Phase>('placing')
  const [skipToken, setSkipToken] = useState(0)
  const [resetToken, setResetToken] = useState(0)
  const failed = run !== null && failedRun === run
  const use3D = threeD && !failed
  const latest = useRef(run)
  latest.current = run
  const reported = useRef<Run | null>(null)

  // Only the current run may report, and only once: a building still falling from an earlier test is ignored.
  const finish = useCallback(
    (key: number) => {
      const current = latest.current
      if (!current || key !== current.key || reported.current === current) return
      reported.current = current
      setFinishedRun(current)
      onDone?.(key)
    },
    [onDone],
  )

  useEffect(() => {
    setPhase('placing')
  }, [run])
  // Nothing to wait for: the plan view, or the 3D builder under reduced motion (it jumps straight to the final state).
  useEffect(() => {
    if (run && (!use3D || reduced)) finish(run.key)
  }, [run, use3D, reduced, finish])

  const done = run !== null && finishedRun === run
  const outcome = input ? OUTCOME_FOR_TIER[input.tier] : null
  const percent = input ? stabilityPercent(input) : 0

  return (
    <Window
      title={t('workshop.windows.builder')}
      variant="primary"
      className={className}
      tools={
        use3D && input ? (
          <>
            {!done && (
              <BevelButton size="sm" onClick={() => setSkipToken((n) => n + 1)}>
                {t('workshop.builder.skip')}
              </BevelButton>
            )}
            <BevelButton size="sm" onClick={() => setResetToken((n) => n + 1)}>
              {t('workshop.builder.resetView')}
            </BevelButton>
          </>
        ) : null
      }
    >
      <div className="ws-builder">
        {!input ? (
          <p className="ws-output__note">{t('workshop.builder.empty')}</p>
        ) : use3D ? (
          <>
            {/* Not keyed by run: one canvas (one WebGL context) for every Build & test of this window. */}
            <SceneBoundary onError={() => setFailedRun(latest.current)}>
              <Suspense fallback={<p className="ws-output__note">{t('workshop.builder.loading')}</p>}>
                <BuilderScene3D
                  input={input}
                  runKey={runKey}
                  skipToken={skipToken}
                  resetToken={resetToken}
                  instant={reduced}
                  aiLabel={t('workshop.builder.aiBlock')}
                  onPhase={setPhase}
                  onDone={finish}
                  onBlockClick={onBlockClick}
                  onReading={onReading}
                />
              </Suspense>
            </SceneBoundary>
            <p className="sr-only">{describeBuilding(input, labels, t)}</p>
          </>
        ) : (
          <>
            {failed && <p className="ws-output__note">{t('workshop.builder.unavailable')}</p>}
            <Builder2D input={input} labels={labels} onBlockClick={onBlockClick} />
          </>
        )}
        {input && (
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
