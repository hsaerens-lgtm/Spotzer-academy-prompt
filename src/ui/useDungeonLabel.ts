import { useTranslation } from 'react-i18next'
import { useApp } from '../core/store'

/** The label of the buttons that open the dungeon, in the office and in reading mode alike (spec 3, §4.6). */
export function useDungeonLabel(): string {
  const { t } = useTranslation()
  const passed = useApp((s) => s.progress.dungeon?.passed === true)
  return passed ? t('welcome.dungeonPassed') : t('welcome.dungeon')
}
