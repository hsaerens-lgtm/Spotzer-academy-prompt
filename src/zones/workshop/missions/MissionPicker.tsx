import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Mission } from '../../../workshop/model'
import { BevelButton } from '../ui/BevelButton'
import { MissionList } from './MissionList'

export interface MissionPickerProps {
  missions: Mission[]
  passed: readonly string[]
  currentId: string
  suggestedId: string
  onSelect: (id: string) => void
  /**
   * Opened in the studio of a mission just picked from the old studio's picker: that picker went away with its studio,
   * so this one takes the focus.
   */
  autoFocus?: boolean
}

/**
 * "All missions" in the studio's title bar: the mission list drops down over the studio and closes again on a pick,
 * Escape or a click elsewhere. Only the missions view has it; the taskbar opens the other programs.
 */
export function MissionPicker({ missions, passed, currentId, suggestedId, onSelect, autoFocus = false }: MissionPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const done = missions.filter((mission) => passed.includes(mission.id)).length

  // Closing from inside the list (a pick or Escape) unmounts the focused mission: the focus goes back to the button.
  const close = useCallback(() => {
    setOpen(false)
    button.current?.focus()
  }, [])

  // On mounting only: the picker is keyed with its mission's view.
  useEffect(() => {
    if (autoFocus) button.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus()
    // Window level and capture phase, like the taskbar's menu: Escape closes the list before Ada's bubble can see it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, close])

  return (
    <div
      className="ws-picker"
      onBlur={(event) => {
        // Focus leaving the picker (Tab, a click elsewhere) closes the list without pulling the focus back.
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <BevelButton ref={button} size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((on) => !on)}>
        {t('workshop.missions.pick')} <span className="ws-picker__count">{t('workshop.missions.counter', { passed: done, total: missions.length })}</span>
        <span aria-hidden="true"> &#9662;</span>
      </BevelButton>
      {open && (
        // A press inside the list must not move the focus: Safari would blur it (relatedTarget null) and close the list
        // before the click lands.
        <div id={panelId} ref={panel} className="ws-picker__panel" onMouseDown={(event) => event.preventDefault()}>
          <MissionList
            missions={missions}
            passed={passed}
            currentId={currentId}
            suggestedId={suggestedId}
            onSelect={(id) => {
              close()
              onSelect(id)
            }}
          />
        </div>
      )}
    </div>
  )
}
