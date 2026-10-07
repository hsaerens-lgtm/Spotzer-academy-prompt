import { useWorkshop } from './store'

/** The workshop's single polite live region: results and Ada's comments. */
export function WorkshopAnnouncer() {
  const message = useWorkshop((s) => s.announcement)
  const count = useWorkshop((s) => s.announcements)
  return (
    <p className="sr-only" aria-live="polite" data-testid="workshop-announcer">
      {/* A new node for every announcement: the same words said again are still a change the reader hears. */}
      <span key={count}>{message}</span>
    </p>
  )
}
