import { useCurrentBeat } from '../core/selectors'
import { useApp } from '../core/store'

/**
 * The one screen-reader announcement of Ada's lines (spec 8.5). It is mounted once, for the whole app, before any
 * topic opens: a live region that appears together with its text is not announced, and the visible line is aria-hidden.
 */
export function DialogueAnnouncer() {
  const inOffice = useApp((s) => s.zone === 'office')
  const beat = useCurrentBeat()
  return (
    <p className="sr-only" aria-live="polite">
      {inOffice && beat ? beat.say : ''}
    </p>
  )
}
