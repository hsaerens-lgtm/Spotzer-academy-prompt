import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../../../core/store'
import type { WorkshopView } from '../store'
import { BevelButton } from './BevelButton'

export const VIEWS: WorkshopView[] = ['missions', 'prompts', 'corrector']

export interface TaskbarProps {
  view: WorkshopView
  passed: number
  total: number
  onView: (view: WorkshopView) => void
  onBack: () => void
}

export function Taskbar({ view, passed, total, onView, onBack }: TaskbarProps) {
  const { t } = useTranslation()
  const sound = useApp((s) => s.settings.sound)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const startRef = useRef<HTMLButtonElement>(null)

  // Closing from the menu (an item or Escape) unmounts the focused item: hand the focus back to the ATHENA button.
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    startRef.current?.focus()
  }, [])
  const pick = (action: () => void) => () => {
    closeMenu()
    action()
  }

  useEffect(() => {
    if (!menuOpen) return
    // Window level and capture phase: Escape works wherever the focus is (Safari and Firefox on macOS do not focus a
    // clicked button), and it closes the menu before Ada's bubble, which listens on the window too, can see it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      closeMenu()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [menuOpen, closeMenu])

  return (
    <nav className="ws-taskbar" aria-label={t('workshop.taskbar.label')}>
      <div
        className="ws-start"
        onBlur={(event) => {
          // Focus leaving the menu (Tab, a click elsewhere) closes it without pulling the focus back.
          if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false)
        }}
      >
        <BevelButton
          ref={startRef}
          tone="primary"
          size="sm"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {t('workshop.taskbar.start')}
        </BevelButton>
        {menuOpen && (
          // A press inside the menu must not move the focus: Safari would blur the trigger (relatedTarget null) and close the menu before the click lands.
          <ul id={menuId} className="ws-start__menu" aria-label={t('workshop.taskbar.menu')} onMouseDown={(event) => event.preventDefault()}>
            {VIEWS.map((item) => (
              <li key={item}>
                <button type="button" className="ws-start__item" onClick={pick(() => onView(item))}>
                  {t(`workshop.desktop.${item}`)}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="ws-start__item" onClick={pick(onBack)}>
                {t('workshop.taskbar.back')}
              </button>
            </li>
          </ul>
        )}
      </div>
      <div className="ws-taskbar__tabs">
        {VIEWS.map((item) => (
          <BevelButton key={item} size="sm" className="ws-taskbar__tab" aria-pressed={view === item} onClick={() => onView(item)}>
            {t(`workshop.desktop.${item}`)}
          </BevelButton>
        ))}
      </div>
      <div className="ws-taskbar__end">
        {/* A toggle: one name, its state in aria-pressed (a label that flips would announce the opposite state). */}
        <BevelButton size="sm" aria-pressed={sound} onClick={() => appStore.getState().setSound(!sound)}>
          {t('workshop.taskbar.sound')}
        </BevelButton>
        <BevelButton size="sm" onClick={onBack}>
          <span aria-hidden="true">&larr; </span>
          {t('workshop.taskbar.back')}
        </BevelButton>
        <span className="ws-taskbar__counter">{t('workshop.taskbar.counter', { passed, total })}</span>
      </div>
    </nav>
  )
}
