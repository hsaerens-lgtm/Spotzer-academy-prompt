import type { StoreApi } from 'zustand/vanilla'
import type { AppState, HoverTarget } from '../core/store'
import { objectActions } from '../zones/office/interactions'

export interface AcademyTestApi {
  state: () => AppState
  clickObject: (target: HoverTarget) => void
  /** Pixel position of a named 3D object's centre; added by TestApiBridge once the canvas is ready. */
  screenPosition?: (name: string) => { x: number; y: number } | null
}

declare global {
  interface Window {
    __academy?: AcademyTestApi
  }
}

/** Development-only hooks for Playwright. Never installed in production builds. */
export function installTestApi(store: StoreApi<AppState>, win: Window = window) {
  win.__academy = { state: () => store.getState(), clickObject: (target) => objectActions[target]() }
}
