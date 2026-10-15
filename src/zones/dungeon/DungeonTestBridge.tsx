import { useEffect } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { correctIds, options } from '../../dungeon/questions'
import type { DungeonState } from './store'

/**
 * Development only: lets the end-to-end tests read the run and play it without depending on the draw. Render it behind
 * `import.meta.env.DEV &&`, like the workshop's bridge, so the test API never reaches a production chunk.
 */
export function DungeonTestBridge({ store }: { store: StoreApi<DungeonState> }) {
  useEffect(() => {
    const api = window.__academy
    if (!api) return
    api.dungeon = () => store.getState().run
    api.dungeonAdvance = () => store.getState().dispatch({ type: 'advance' })
    api.dungeonAnswer = (correct) => {
      const run = store.getState().run
      if (!run || run.current === null) return
      const { question } = run.asked[run.current]
      const right = correctIds(question)
      const wrong = options(question)
        .map((o) => o.id)
        .find((id) => !right.includes(id))!
      store.getState().dispatch({ type: 'answer', picked: correct ? right : [wrong] })
    }
    return () => {
      delete api.dungeon
      delete api.dungeonAdvance
      delete api.dungeonAnswer
    }
  }, [store])
  return null
}
