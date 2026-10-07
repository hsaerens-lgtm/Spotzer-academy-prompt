import { useTranslation } from 'react-i18next'
import { useApp } from '../core/store'
import { listedMissionIds } from '../workshop/missionIndex'

/**
 * The label of the buttons that open the workshop, in the office and in reading mode alike: "Prompt workshop", with
 * the passed missions out of the total once there is one. Spec 4.6: the saved id of a mission removed or renamed since
 * is not counted.
 */
export function useWorkshopLabel(): string {
  const { t } = useTranslation()
  const missionIds = listedMissionIds(useApp((s) => s.settings.lang))
  const passed = useApp((s) => (s.progress.workshop?.passed ?? []).filter((id) => missionIds.includes(id)).length)
  return passed > 0 ? t('welcome.workshopProgress', { done: passed, total: missionIds.length }) : t('welcome.workshop')
}
