import { useApp } from '../../core/store'
import { DialogueBox } from '../../ui/DialogueBox'
import { TopicMenu } from '../../ui/TopicMenu'
import { WelcomeBar } from '../../ui/WelcomeBar'

export function OfficeOverlay() {
  const activeTopic = useApp((s) => s.activeTopic)
  const menuOpen = useApp((s) => s.menuOpen)
  const inTransition = useApp((s) => s.transition !== null)
  if (inTransition) return null
  if (activeTopic) return <DialogueBox />
  if (menuOpen) return <TopicMenu />
  return <WelcomeBar />
}
