import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../../../core/store'

/** The office HUD is hidden in the dungeon: its Sound setting lives here. A toggle: one name, its state in aria-pressed. */
export function SoundToggle() {
  const { t } = useTranslation()
  const on = useApp((s) => s.settings.sound)
  return (
    <button type="button" className="dg-btn dg-btn--small" aria-pressed={on} onClick={() => appStore.getState().setSound(!on)}>
      {t('dungeon.sound')}
    </button>
  )
}
