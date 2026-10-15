import type { StoreApi } from 'zustand/vanilla'
import type { Phase } from '../core/phase'
import type { AppState, HoverTarget } from '../core/store'
import { objectActions } from '../zones/office/interactions'

/** What the lighting of the 3D office is right now (read by the e2e tests of the time of day). */
export interface LightingSnapshot {
  phase: Phase
  transitioning: boolean
  /** gl.toneMappingExposure */
  exposure: number
  /** scene.environmentIntensity */
  environmentIntensity: number
  /** Light named 'sun' (NaN when it is missing). */
  sunIntensity: number
  /** '#' + the sun's colour as hex ('' when it is missing). */
  sunColor: string
  /** Light named 'window-light'. */
  windowIntensity: number
  /** Light named 'lamp-light'. */
  lampIntensity: number
}

export interface AcademyTestApi {
  state: () => AppState
  clickObject: (target: HoverTarget) => void
  /** Sets the time of day at once, without a transition. */
  setPhase: (phase: Phase) => void
  /** Moves the camera rail target: 0 is the overview, 1 the presentation view. */
  rail: (t: number) => void
  /** Pixel position of a named 3D object's centre; added by TestApiBridge once the canvas is ready. */
  screenPosition?: (name: string) => { x: number; y: number } | null
  /** Current exposure, environment and named light levels; added by TestApiBridge. */
  lighting?: () => LightingSnapshot
  /** Material audit of the scene groups 'base' and 'decor' (`path#material` entries); added by TestApiBridge. */
  untexturedMeshes?: () => string[]
  /** The workshop screen state; added by WorkshopTestBridge while the workshop is open (development only). */
  workshop?: () => unknown
  /** The dungeon run (null on the title screen); added by DungeonTestBridge while the dungeon is open. */
  dungeon?: () => unknown
  /** Answers the open encounter right or wrong, whatever the draw. */
  dungeonAnswer?: (correct: boolean) => void
  /** Text-mode advance: in front of the next guardian, or of the boss. */
  dungeonAdvance?: () => void
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
