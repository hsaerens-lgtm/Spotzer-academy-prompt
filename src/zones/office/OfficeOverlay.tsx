import { useApp } from '../../core/store'
import { DialogueBox } from '../../ui/DialogueBox'
import { ExpandOverlay } from '../../ui/ExpandOverlay'
import { TopicMenu } from '../../ui/TopicMenu'
import { WelcomeBar } from '../../ui/WelcomeBar'

export function OfficeOverlay() {
  const activeTopic = useApp((s) => s.activeTopic)
  const menuOpen = useApp((s) => s.menuOpen)
  const expandOpen = useApp((s) => s.expandOpen)
  const inTransition = useApp((s) => s.transition !== null)
  if (inTransition) return null
  return (
    <>
      {activeTopic ? <DialogueBox /> : menuOpen ? <TopicMenu /> : <WelcomeBar />}
      {activeTopic && expandOpen && <ExpandOverlay />}
    </>
  )
}
