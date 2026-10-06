import { useWorkshop } from './store'

/** The workshop's single polite live region: results and Ada's comments. */
export function WorkshopAnnouncer() {
  const message = useWorkshop((s) => s.announcement)
  return (
    <p className="sr-only" aria-live="polite" data-testid="workshop-announcer">
      {message}
    </p>
  )
}
