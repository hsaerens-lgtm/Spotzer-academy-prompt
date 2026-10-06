import { useId, useState } from 'react'
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
  const pick = (action: () => void) => () => {
    setMenuOpen(false)
    action()
  }
  return (
    <nav className="ws-taskbar" aria-label={t('workshop.taskbar.label')}>
      <div
        className="ws-start"
        onKeyDown={(event) => {
          // Escape closes the menu first; it must not also close Ada's bubble.
          if (event.key === 'Escape' && menuOpen) {
            event.stopPropagation()
            setMenuOpen(false)
          }
        }}
      >
        <BevelButton tone="primary" size="sm" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen((open) => !open)}>
          {t('workshop.taskbar.start')}
        </BevelButton>
        {menuOpen && (
          <ul id={menuId} className="ws-start__menu" aria-label={t('workshop.taskbar.menu')}>
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
        <BevelButton size="sm" aria-pressed={sound} onClick={() => appStore.getState().setSound(!sound)}>
          {sound ? t('workshop.taskbar.soundOn') : t('workshop.taskbar.soundOff')}
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
