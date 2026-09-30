import type { ComponentType } from 'react'
import type { ZoneId } from '../core/store'

export interface ZoneModule {
  id: ZoneId
  /** Rendered inside the shared Canvas (used by the dungeon, spec 3). */
  Scene?: ComponentType
  /** DOM rendered above the Canvas. */
  Overlay?: ComponentType
}

type LazyZoneId = Exclude<ZoneId, 'office'>

const loaders: Record<LazyZoneId, () => Promise<ZoneModule>> = {
  workshop: () => import('../zones/workshop').then((m) => m.workshopZone),
  dungeon: () => import('../zones/dungeon').then((m) => m.dungeonZone),
}

const cache = new Map<LazyZoneId, Promise<ZoneModule>>()

export function loadZone(id: LazyZoneId): Promise<ZoneModule> {
  let promise = cache.get(id)
  if (!promise) {
    promise = loaders[id]()
    cache.set(id, promise)
  }
  return promise
}
