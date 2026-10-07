import type { StoreApi } from 'zustand/vanilla'
import type { Phase } from '../core/phase'
import type { AppState, HoverTarget } from '../core/store'
import { objectActions } from '../zones/office/interactions'

export interface AcademyTestApi {
  state: () => AppState
  clickObject: (target: HoverTarget) => void
  /** Sets the time of day at once, without a transition. */
  setPhase: (phase: Phase) => void
  /** Moves the camera rail target: 0 is the overview, 1 the presentation view. */
  rail: (t: number) => void
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
  win.__academy = {
    state: () => store.getState(),
    clickObject: (target) => objectActions[target](),
    setPhase: (phase) => store.getState().setPhase(phase),
    rail: (t) => store.getState().setRailTarget(t),
  }
}
