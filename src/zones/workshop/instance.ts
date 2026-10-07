import type { StoreApi } from 'zustand/vanilla'
import { appStore } from '../../core/store'
import { getWorkshopContent } from '../../workshop/content'
import { createCorrectorApi } from './corrector/api'
import { createWorkshopStore, type WorkshopState } from './store'

let instance: StoreApi<WorkshopState> | null = null

/** One workshop state per page, so drafts survive a trip to the office and back. */
export function getWorkshopStore(): StoreApi<WorkshopState> {
  if (!instance) {
    const content = getWorkshopContent(appStore.getState().settings.lang)
    instance = createWorkshopStore({
      content,
      api: createCorrectorApi(),
      passMission: (id, prompt) => appStore.getState().passWorkshopMission(id, prompt, content.missions.length),
    })
  }
  return instance
}

/** Tests only: start the next render from a fresh workshop. */
export function resetWorkshopStore() {
  instance = null
}
