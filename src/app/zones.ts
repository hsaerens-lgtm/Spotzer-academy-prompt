import type { ComponentType } from 'react'
import type { ZoneId } from '../core/store'

export interface ZoneModule {
  id: ZoneId
  /** Rendered inside the shared Canvas (used by the dungeon, spec 3). */
  Scene?: ComponentType
  /** DOM rendered above the Canvas. */
  Overlay?: ComponentType
}

export type LazyZoneId = Exclude<ZoneId, 'office'>

type ZoneLoaders = Record<LazyZoneId, () => Promise<ZoneModule>>

export function createZoneLoader(loaders: ZoneLoaders): (id: LazyZoneId) => Promise<ZoneModule> {
  const cache = new Map<LazyZoneId, Promise<ZoneModule>>()
  return (id) => {
    let promise = cache.get(id)
    if (!promise) {
      const created = loaders[id]()
      promise = created
      cache.set(id, created)
      // A rejected import (a stale tab after a redeploy) must not stay cached forever: the next attempt retries.
      created.catch(() => {
        if (cache.get(id) === created) cache.delete(id)
      })
    }
    return promise
  }
}

export const loadZone = createZoneLoader({
  workshop: () => import('../zones/workshop').then((m) => m.workshopZone),
  dungeon: () => import('../zones/dungeon').then((m) => m.dungeonZone),
})
