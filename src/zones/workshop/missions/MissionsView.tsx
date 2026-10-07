import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../../core/store'
import { inputFromEvaluation, type BuildingInput } from '../../../workshop/building/plan'
import { suggestedMission } from '../../../workshop/content'
import { adviceFor, assemblePrompt, blockResult, evaluate, nextTip, wordCount } from '../../../workshop/engine/evaluate'
import type { Span } from '../../../workshop/engine/text'
import type { BlockType, CoreBlock, Detail } from '../../../workshop/model'
import { AdaBubble } from '../ada/AdaBubble'
import { useWorkshop, useWorkshopStore } from '../store'
import { BevelButton } from '../ui/BevelButton'
import { adaMessage, type AdaAction, type Tip } from './adaMessage'
import { AiOutput } from './AiOutput'
import { PromptStudio, type StudioHandle } from './PromptStudio'

export const TIP_DELAY_MS = 2000
export const TIP_MIN_WORDS = 8
const NO_PASSES: readonly string[] = []

export interface BuilderSlotProps {
  input: BuildingInput | null
  runKey: number
  onDone: (runKey: number) => void
  onBlockClick: (block: CoreBlock) => void
  onReading: (block: CoreBlock | null) => void
}

export interface MissionsViewProps {
  missionId: string
  onSelectMission: (id: string) => void
  renderBuilder: (props: BuilderSlotProps) => ReactNode
}

export function MissionsView({ missionId, onSelectMission, renderBuilder }: MissionsViewProps) {
  const { t } = useTranslation()
  const store = useWorkshopStore()
  const content = useWorkshop((s) => s.content)
  const session = useWorkshop((s) => s.sessions[missionId])
  const passed = useApp((s) => s.progress.workshop?.passed) ?? NO_PASSES
  const mission = content.missionById.get(missionId)!
  const studio = useRef<StudioHandle>(null)
  const [revealedId, setRevealedId] = useState<number | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const [sorry, setSorry] = useState<Detail | null>(null)
  const [compare, setCompare] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [reading, setReading] = useState<CoreBlock | null>(null)

  const draft = session.draft
  const attempt = session.last
  const revealed = attempt !== null && revealedId === attempt.id
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

  // One announcement per revealed result (and per tip), with Ada's words.
  useEffect(() => {
    if (tip) store.getState().announce(message.text)
    else if (attempt && revealed && attempt.id > 0) store.getState().announce(`${t(`workshop.output.tier.${attempt.evaluation.tier}`)}. ${message.text}`)
    // Deliberately keyed on a new result or tip only: message.text, store and t follow from them.
  }, [attempt, revealed, tip])

  const onDone = useCallback((key: number) => setRevealedId(key), [])
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
    } else if (action === 'alreadyThere' && advice && (advice.kind === 'hole' || advice.kind === 'weak')) {
      setSorry(advice.detail)
      setDismissed(null)
      store.getState().alreadyThere(missionId, advice.detail.id)
    } else if (action === 'next') {
      onSelectMission(suggestedMission(content, passed).id)
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

  // The mission list is the workshop's (it stays on screen in every program), so this view starts at the studio.
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
      />
      {renderBuilder({ input: buildingInput, runKey: attempt?.id ?? 0, onDone, onBlockClick, onReading: setReading })}
      <AiOutput
        className="ws-area-output"
        mission={mission}
        session={session}
        revealed={revealed}
        compare={compare && canCompare}
        labels={content.labels}
      />
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
