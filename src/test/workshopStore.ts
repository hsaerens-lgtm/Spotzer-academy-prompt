import { appStore } from '../core/store'
import { getWorkshopContent } from '../workshop/content'
import { makeReport } from './workshopFixtures'
import { createWorkshopStore, type CorrectorApi } from '../zones/workshop/store'

/** The ids of the real missions, in order: what passWorkshopMission needs to know when the workshop is done. */
export const MISSION_IDS: readonly string[] = getWorkshopContent('en').missions.map((mission) => mission.id)

export function fakeApi(overrides: Partial<CorrectorApi> = {}): CorrectorApi {
  return {
    health: async () => ({ ok: true, data: { corrector: true } }),
    correct: async () => ({ ok: true, data: makeReport() }),
    run: async (prompt) => ({ ok: true, data: { answer: `Answer to: ${prompt}` } }),
    ...overrides,
  }
}

export function makeWorkshopStore(options: { api?: Partial<CorrectorApi>; passMission?: (id: string, prompt: string) => void } = {}) {
  const content = getWorkshopContent('en')
  return createWorkshopStore({
    content,
    api: fakeApi(options.api),
    passMission: options.passMission ?? ((id, prompt) => appStore.getState().passWorkshopMission(id, prompt, MISSION_IDS)),
  })
}
