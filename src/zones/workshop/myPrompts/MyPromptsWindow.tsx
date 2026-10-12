import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../../../core/store'
import { CopyFallbackField } from '../CopyFallbackField'
import { useCopyWithFallback } from '../copy'
import { useWorkshop } from '../store'
import { BevelButton } from '../ui/BevelButton'
import { Window } from '../ui/Window'

const NO_PROMPTS: Readonly<Record<string, string>> = {}

/** The prompt that was copied last, as it was then: a prompt saved again with other words is no longer "copied". */
interface Copied {
  id: string
  text: string
}

export function MyPromptsWindow({ className }: { className?: string }) {
  const { t } = useTranslation()
  const content = useWorkshop((s) => s.content)
  const prompts = useApp((s) => s.progress.workshop?.prompts) ?? NO_PROMPTS
  const [confirming, setConfirming] = useState(false)
  const [last, setLast] = useState<Copied | null>(null)
  const clipboard = useCopyWithFallback()
  const confirmId = useId()
  const clearButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const emptyNote = useRef<HTMLParagraphElement>(null)
  // Where the focus goes when the confirmation closes (its buttons unmount): back to Clear, or to the empty hint once cleared.
  const refocus = useRef<'clear' | 'empty' | null>(null)
  // Spec 2, 4.6: ids of missions that are not in the content (saved by another version) are not listed.
  const entries = content.missions.filter((mission) => prompts[mission.id])
  const current = last && prompts[last.id] === last.text ? last.id : null

  useEffect(() => {
    if (confirming) {
      cancelButton.current?.focus()
      return
    }
    const target = refocus.current === 'empty' ? emptyNote.current : refocus.current === 'clear' ? clearButton.current : null
    refocus.current = null
    target?.focus()
  }, [confirming])

  const copy = (id: string) => {
    clipboard.reset()
    setLast({ id, text: prompts[id] })
    void clipboard.copy(prompts[id])
  }
  const close = (cleared: boolean) => {
    refocus.current = cleared ? 'empty' : 'clear'
    if (cleared) {
      clipboard.reset()
      setLast(null)
      appStore.getState().clearWorkshopPrompts()
    }
    setConfirming(false)
  }

  return (
    <Window title={t('workshop.windows.prompts')} variant="primary" className={className}>
      {entries.length === 0 ? (
        <p ref={emptyNote} tabIndex={-1} className="ws-output__note">
          {t('workshop.prompts.empty')}
        </p>
      ) : (
        <>
          <ul className="ws-prompts">
            {entries.map((mission) => (
              <li key={mission.id} className="ws-prompts__item">
                <h3 className="ws-prompts__title">{mission.title}</h3>
                {current === mission.id && clipboard.fallback !== null ? (
                  <CopyFallbackField text={prompts[mission.id]} selectRef={clipboard.selectFallback} rows={5} />
                ) : (
                  <pre className="ws-prompts__text">{prompts[mission.id]}</pre>
                )}
                <BevelButton size="sm" onClick={() => copy(mission.id)}>
                  {current === mission.id && clipboard.copied ? t('workshop.prompts.copied') : t('workshop.prompts.copy')}
                </BevelButton>
              </li>
            ))}
          </ul>
          {confirming ? (
            <div className="ws-prompts__confirm">
              <p id={confirmId}>{t('workshop.prompts.confirm')}</p>
              <BevelButton tone="primary" size="sm" onClick={() => close(true)}>
                {t('workshop.prompts.confirmYes')}
              </BevelButton>
              <BevelButton ref={cancelButton} size="sm" aria-describedby={confirmId} onClick={() => close(false)}>
                {t('workshop.prompts.cancel')}
              </BevelButton>
            </div>
          ) : (
            <BevelButton ref={clearButton} onClick={() => setConfirming(true)}>
              {t('workshop.prompts.clear')}
            </BevelButton>
          )}
        </>
      )}
    </Window>
  )
}
