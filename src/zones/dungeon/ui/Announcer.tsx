import { useTranslation } from 'react-i18next'
import { useDungeon } from '../store'

/** The dungeon's single polite live region (spec 3, §6.3). */
export function Announcer() {
  const { t } = useTranslation()
  const announcement = useDungeon((s) => s.announcement)
  return (
    <p className="sr-only" aria-live="polite" aria-label={t('dungeon.announcer')} data-testid="dungeon-announcer">
      {/* A new node per announcement: the same words said again are still a change the reader hears. */}
      {announcement && <span key={announcement.id}>{announcement.text}</span>}
    </p>
  )
}
