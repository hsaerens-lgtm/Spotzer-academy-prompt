import { useEffect } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import type { WorkshopState } from './store'

/**
 * Development only: lets the end-to-end tests read the workshop state while it is open. Render it behind
 * `import.meta.env.DEV &&`, like the office's TestApiBridge, so the test API never reaches a production chunk.
 */
export function WorkshopTestBridge({ store }: { store: StoreApi<WorkshopState> }) {
  useEffect(() => {
    const api = window.__academy
    if (!api) return
    api.workshop = () => store.getState()
    return () => {
      delete api.workshop
    }
  }, [store])

  return null
}
