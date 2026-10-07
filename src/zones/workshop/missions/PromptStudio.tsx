import { useImperativeHandle, useRef, type KeyboardEvent, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { assemblePrompt, blockResult, isBlank } from '../../../workshop/engine/evaluate'
import type { Span } from '../../../workshop/engine/text'
import { BLOCK_TYPES, BONUS_BLOCKS, MAX_BLOCK_TEXT, MAX_FREE_TEXT, isCoreBlock, type BlockType, type CoreBlock, type Mission } from '../../../workshop/model'
import { useCopyWithFallback } from '../copy'
import { isSubmitShortcut } from '../keys'
import type { MissionSession } from '../store'
import { BevelButton } from '../ui/BevelButton'
import { Window } from '../ui/Window'
import { MaterialBadge } from './MaterialBadge'

export interface StudioHandle {
  focusBlock(type: BlockType, span?: Span): void
}

export interface PromptStudioProps {
  ref?: Ref<StudioHandle>
  className?: string
  mission: Mission
  number: number
  session: MissionSession
  labels: Record<BlockType, string>
  onBlock: (type: BlockType, value: string) => void
  onAddBlock: (type: BlockType) => void
  onText: (value: string) => void
  onTest: () => void
  onReset: () => void
  /** The structural block the AI is reading in the builder right now. */
  reading?: CoreBlock | null
}

export function PromptStudio(props: PromptStudioProps) {
  const { ref, className, mission, number, session, labels, onBlock, onAddBlock, onText, onTest, onReset, reading = null } = props
  const { t } = useTranslation()
  const fields = useRef(new Map<BlockType, HTMLTextAreaElement>())
  const text = useRef<HTMLTextAreaElement>(null)
  // "Copied" and the selected fallback are about the prompt as it was copied: any change to the prompt resets them.
  const clipboard = useCopyWithFallback()
  const draft = session.draft
  const blank = isBlank(draft)
  // Material badges describe the last test, so they only show while the prompt is unchanged since then.
  const tested = session.last && session.last.id > 0 && session.last.input === draft ? session.last.evaluation : null
  // While the AI reads the building, free text shows the sentence that built the block being read.
  const last = session.last
  const readSpan = reading && last && last.input.mode !== 'blocks' ? blockResult(last.evaluation, reading).spans[0] : undefined
  const readingSentence = readSpan && last && last.input.mode !== 'blocks' ? last.input.text.slice(readSpan.start, readSpan.end) : null

  useImperativeHandle(
    ref,
    () => ({
      focusBlock: (type, span) => {
        const target = draft.mode === 'blocks' ? fields.current.get(type) : text.current
        if (!target) return
        target.focus()
        if (span) target.setSelectionRange(span.start, span.end)
        else target.setSelectionRange(target.value.length, target.value.length)
      },
    }),
    [draft.mode],
  )

  const test = () => {
    clipboard.reset()
    onTest()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isSubmitShortcut(event)) return
    event.preventDefault()
    if (!blank) test()
  }

  return (
    <Window title={t('workshop.windows.studio', { number })} variant="primary" className={className}>
      <div className="ws-brief">
        <h3 className="ws-brief__title">{t('workshop.studio.situation')}</h3>
        <p className="ws-brief__text">{mission.situation}</p>
        <p className="ws-brief__goal">
          <strong>{t('workshop.studio.goal')}</strong> {mission.goal}
        </p>
      </div>

      {draft.mode === 'blocks' ? (
        <div className="ws-blocks">
          {BLOCK_TYPES.filter((type) => isCoreBlock(type) || session.addedBlocks.includes(type) || (draft.blocks[type] ?? '') !== '').map((type) => (
            <div key={type} className={`ws-block ws-block--${type}${type === reading ? ' is-reading' : ''}`}>
              <span className="ws-block__tag" aria-hidden="true">
                {labels[type]}
              </span>
              <textarea
                ref={(element) => {
                  if (element) fields.current.set(type, element)
                  else fields.current.delete(type)
                }}
                className="ws-field"
                rows={2}
                maxLength={MAX_BLOCK_TEXT}
                aria-label={t('workshop.studio.blockLabel', { label: labels[type] })}
                placeholder={mission.blocks[type].placeholder}
                value={draft.blocks[type] ?? ''}
                onChange={(event) => {
                  clipboard.reset()
                  onBlock(type, event.target.value)
                }}
                onKeyDown={onKeyDown}
              />
              {tested && <MaterialBadge result={blockResult(tested, type)} />}
            </div>
          ))}
          {BONUS_BLOCKS.some((type) => !session.addedBlocks.includes(type) && !(draft.blocks[type] ?? '')) && (
            <div className="ws-add-block">
              <span>{t('workshop.studio.addBlock')}</span>
              {BONUS_BLOCKS.filter((type) => !session.addedBlocks.includes(type) && !(draft.blocks[type] ?? '')).map((type) => (
                <BevelButton key={type} size="sm" onClick={() => onAddBlock(type)}>
                  {labels[type]}
                </BevelButton>
              ))}
            </div>
          )}
        </div>
      ) : (
        <label className="ws-free">
          <span className="ws-free__label">{t('workshop.studio.freeLabel')}</span>
          <textarea
            ref={text}
            className="ws-field"
            rows={9}
            maxLength={MAX_FREE_TEXT}
            value={draft.text}
            onChange={(event) => {
              clipboard.reset()
              onText(event.target.value)
            }}
            onKeyDown={onKeyDown}
          />
          {readingSentence && (
            <p className="ws-reading" aria-hidden="true">
              <mark>{readingSentence}</mark>
            </p>
          )}
        </label>
      )}

      <div className="ws-studio__actions">
        <BevelButton tone="primary" disabled={blank} aria-keyshortcuts="Control+Enter" onClick={test}>
          {t('workshop.studio.build')}
        </BevelButton>
        <BevelButton disabled={blank} onClick={() => void clipboard.copy(assemblePrompt(draft, labels))}>
          {clipboard.copied ? t('workshop.studio.copied') : t('workshop.studio.copy')}
        </BevelButton>
        {mission.mode === 'fix' && (
          <BevelButton
            onClick={() => {
              clipboard.reset()
              onReset()
            }}
          >
            {t('workshop.studio.reset')}
          </BevelButton>
        )}
        <span className="ws-studio__shortcut" aria-hidden="true">
          {t('workshop.studio.shortcut')}
        </span>
      </div>
      {clipboard.fallback !== null && (
        <label className="ws-copy-fallback">
          {t('workshop.studio.copyFallback')}
          <textarea ref={clipboard.selectFallback} className="ws-field" readOnly rows={4} value={clipboard.fallback} />
        </label>
      )}
    </Window>
  )
}
