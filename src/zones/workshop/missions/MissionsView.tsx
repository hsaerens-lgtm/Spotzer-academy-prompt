import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../../core/store'
import { inputFromEvaluation, type BuildingInput } from '../../../workshop/building/plan'
import { suggestedMission } from '../../../workshop/content'
import { adviceFor, assemblePrompt, blockResult, evaluate, nextTip, wordCount } from '../../../workshop/engine/evaluate'
import type { Span } from '../../../workshop/engine/text'
import { CORE_BLOCKS, type BlockType, type CoreBlock, type Detail } from '../../../workshop/model'
import { AdaBubble } from '../ada/AdaBubble'
import { useWorkshop, useWorkshopStore } from '../store'
import { BevelButton } from '../ui/BevelButton'
import { adaMessage, offersAlreadyThere, type AdaAction, type Tip } from './adaMessage'
import { AiOutput } from './AiOutput'
import { PromptStudio, type StudioHandle } from './PromptStudio'

export const TIP_DELAY_MS = 2000
export const TIP_MIN_WORDS = 8
const NO_PASSES: readonly string[] = []

export interface BuilderSlotProps {
  input: BuildingInput | null
  runKey: number
  /**
   * The result is revealed: its building was seen to its end, perhaps before this view was last opened. The builder
   * then shows the final state without a replay.
   */
  seen: boolean
  onDone: (runKey: number) => void
  /** The 3D builder failed during this run and the plan view shows it: the result's announcement says so first. */
  onUnavailable: (runKey: number) => void
  onBlockClick: (block: CoreBlock) => void
  onReading: (block: CoreBlock | null) => void
}

export interface MissionsViewProps {
  missionId: string
  /** Ada's "Next mission": opens the suggested mission (the list of missions belongs to the desktop). */
  onNextMission: (id: string) => void
  renderBuilder: (props: BuilderSlotProps) => ReactNode
  /** Opened by "Next mission": the button that had the focus went away, so the first editor takes it. */
  focusOnOpen?: boolean
  /** The mission picker, in the studio's title bar (the desktop owns the list of missions). */
  picker?: ReactNode
}

export function MissionsView({ missionId, onNextMission, renderBuilder, focusOnOpen = false, picker }: MissionsViewProps) {
  const { t } = useTranslation()
  const store = useWorkshopStore()
  const content = useWorkshop((s) => s.content)
  const session = useWorkshop((s) => s.sessions[missionId])
  const passed = useApp((s) => s.progress.workshop?.passed) ?? NO_PASSES
  const mission = content.missionById.get(missionId)!
  const studio = useRef<StudioHandle>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const [sorry, setSorry] = useState<Detail | null>(null)
  const [compare, setCompare] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [reading, setReading] = useState<CoreBlock | null>(null)

  const draft = session.draft
  const attempt = session.last
  // In the store, not in this view: the view is unmounted while another mission or program is open.
  const revealed = attempt !== null && session.revealedAttempt === attempt.id
  const buildingInput = useMemo(() => (attempt ? inputFromEvaluation(attempt.evaluation) : null), [attempt])
  const allDone = content.missions.every((m) => passed.includes(m.id))
  const message = adaMessage({ mission, attempt, revealed, tip, sorry, allDone, labels: content.labels, t })

  // Level 2 only: after a pause in typing, Ada points at the first hole or cardboard block, once per detail.
  useEffect(() => {
    if (mission.mode !== 'free' || draft.mode !== 'free' || session.tipsMuted) return
    if (wordCount(draft.text) < TIP_MIN_WORDS) return
    const lastTest = store.getState().sessions[missionId].last
    const timer = window.setTimeout(() => {
      const current = store.getState().sessions[missionId]
      // A test since the last keystroke: Ada is commenting on its result now, not on the typing.
      if (current.last !== lastTest) return
      const evaluation = evaluate(mission, current.draft, new Set(current.overrides))
      const next = nextTip(mission, evaluation, new Set(current.tipsShown))
      if (!next) return
      store.getState().markTipShown(missionId, next.detail.id)
      setSorry(null)
      setDismissed(null)
      setTip(next)
    }, TIP_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draft, mission, missionId, session.tipsMuted, store])

  // Opened by "Next mission": the first editor (Role, or the prompt field in free text) takes the focus. On opening
  // only: the view is keyed by mission, so it opens again for every mission.
  useEffect(() => {
    if (focusOnOpen) studio.current?.focusBlock(CORE_BLOCKS[0])
  }, [])

  // The attempt whose building the plan view took over from a failed 3D builder (spec 6.1).
  const planViewRun = useRef<number | null>(null)
  const onUnavailable = useCallback((key: number) => {
    planViewRun.current = key
  }, [])

  // One announcement per revealed result (and per tip), with Ada's words. A result already revealed when the view
  // opens was announced at the time: the first run skips it.
  const opening = useRef(true)
  useEffect(() => {
    const first = opening.current
    opening.current = false
    if (tip) store.getState().announce(message.text)
    else if (attempt && revealed && attempt.id > 0 && !first) {
      const fallback = planViewRun.current === attempt.id ? `${t('workshop.builder.unavailable')} ` : ''
      store.getState().announce(`${fallback}${t(`workshop.output.tier.${attempt.evaluation.tier}`)}. ${message.text}`)
    }
    // Deliberately keyed on a new result or tip only: message.text, store and t follow from them.
  }, [attempt, revealed, tip])

  // Only the latest attempt's building may reveal it (the store ignores one finishing for an older attempt).
  const onDone = useCallback((key: number) => store.getState().revealAttempt(missionId, key), [store, missionId])
  /**
   * The passage of the last tested prompt that built `block`, only while the editor still holds that prompt:
   * after an edit its offsets would land on other words. Read from the store, so the callbacks stay stable while typing.
   */
  const testedSpan = useCallback(
    (block: BlockType): Span | undefined => {
      const { last, draft: current } = store.getState().sessions[missionId]
      return last && last.input === current ? blockResult(last.evaluation, block).spans[0] : undefined
    },
    [store, missionId],
  )
  const onBlockClick = useCallback((block: CoreBlock) => studio.current?.focusBlock(block, testedSpan(block)), [testedSpan])

  const test = () => {
    setTip(null)
    setSorry(null)
    setCompare(false)
    setDismissed(null)
    setReading(null)
    store.getState().test(missionId)
  }

  const advice = attempt && revealed && attempt.id > 0 ? adviceFor(mission, attempt.evaluation) : null
  const act = (action: AdaAction) => {
    if (action === 'notNow') {
      store.getState().muteTips(missionId)
      setTip(null)
    } else if (action === 'edit' && attempt && advice && advice.kind !== 'success') {
      // Free text: the caret goes to the end of the sentence that built the block, while the text is still the tested one.
      // Blocks (or a hole, or an edited text): the end of the field. A caret, not a selection, so typing never erases the sentence.
      const sentence = attempt.evaluation.source === 'text' ? testedSpan(advice.block) : undefined
      studio.current?.focusBlock(advice.block, sentence && { start: sentence.end, end: sentence.end })
    } else if (action === 'alreadyThere' && attempt && advice && offersAlreadyThere(advice, attempt.evaluation)) {
      setSorry(advice.detail)
      setDismissed(null)
      store.getState().alreadyThere(missionId, advice.detail.id)
    } else if (action === 'next') {
      onNextMission(suggestedMission(content, passed).id)
    } else if (action === 'compare') {
      setCompare((on) => !on)
    }
  }
  // Before / After only when the prompt changed: a double-clicked or "already there" success would give two identical columns.
  const canCompare =
    session.first !== null && attempt !== null && assemblePrompt(session.first.input, content.labels) !== assemblePrompt(attempt.input, content.labels)
  const actions = message.actions.filter((action) => action !== 'compare' || canCompare)
  // The compare toggle keeps one label; aria-pressed carries its state.
  const actionLabel = (action: AdaAction) => t(action === 'compare' ? 'workshop.output.compare' : `workshop.ada.${action}`)

  return (
    <>
      <PromptStudio
        ref={studio}
        className="ws-area-studio"
        mission={mission}
        number={content.missions.indexOf(mission) + 1}
        session={session}
        labels={content.labels}
        onBlock={(type, value) => store.getState().setBlock(missionId, type, value)}
        onAddBlock={(type) => store.getState().addBlock(missionId, type)}
        onText={(value) => store.getState().setText(missionId, value)}
        onTest={test}
        onReset={() => store.getState().resetDraft(missionId)}
        revealed={revealed}
        reading={reading}
        tools={picker}
      />
      {/* A fix mission's starter (attempt 0) is not the learner's test: its building is already standing, collapsed (spec 3.6). */}
      {renderBuilder({
        input: buildingInput,
        runKey: attempt?.id ?? 0,
        seen: revealed || attempt?.id === 0,
        onDone,
        onUnavailable,
        onBlockClick,
        onReading: setReading,
      })}
      {/* Nothing to read before the first test: the builder then has the right-hand column to itself. */}
      {attempt && (
        <AiOutput
          className="ws-area-output"
          mission={mission}
          session={session}
          revealed={revealed}
          compare={compare && canCompare}
          labels={content.labels}
        />
      )}
      <AdaBubble
        text={message.text === dismissed ? null : message.text}
        mood={message.mood}
        pointing={message.pointing}
        onDismiss={() => setDismissed(message.text)}
        actions={
          actions.length > 0
            ? actions.map((action) => (
                <BevelButton
                  key={action}
                  size="sm"
                  tone={action === 'next' ? 'primary' : 'plain'}
                  aria-pressed={action === 'compare' ? compare : undefined}
                  onClick={() => act(action)}
                >
                  {actionLabel(action)}
                </BevelButton>
              ))
            : undefined
        }
      />
    </>
  )
}
