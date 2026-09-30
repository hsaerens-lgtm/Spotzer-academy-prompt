import { getContent, type LangContent } from '../content/load'
import type { Beat, ScreenRef, Topic } from '../content/schema'
import { currentBeat, screenAt } from '../dialogue/engine'
import { useApp } from './store'

export function useContent(): LangContent {
  const lang = useApp((s) => s.settings.lang)
  return getContent(lang)
}

export function useActiveTopic(): Topic | null {
  const id = useApp((s) => s.activeTopic)
  const content = useContent()
  return id ? (content.topicById.get(id) ?? null) : null
}

export function useCurrentBeat(): Beat | null {
  const dialogue = useApp((s) => s.dialogue)
  const topic = useActiveTopic()
  return dialogue && topic ? currentBeat(dialogue, topic) : null
}

export function useScreenRef(): ScreenRef | null {
  const dialogue = useApp((s) => s.dialogue)
  const topic = useActiveTopic()
  return dialogue && topic ? screenAt(dialogue, topic) : null
}
