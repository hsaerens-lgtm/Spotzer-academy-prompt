import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { getContent } from '../content/load'
import type { Topic } from '../content/schema'
import * as engine from '../dialogue/engine'
import type { Choice, DialogueState } from '../dialogue/engine'
import { PHASE_SECONDS, nextPhase, parsePhaseParam, phaseForTime, type Phase, type PhaseTransition } from './phase'
import {
  loadProgress,
  loadSettings,
  markSeen,
  saveProgress,
  saveSettings,
  withMissionPassed,
  withoutWorkshopPrompts,
  type Progress,
  type Settings,
  type StorageLike,
} from './progress'

export type ZoneId = 'office' | 'workshop' | 'dungeon'
export const ZONES: readonly ZoneId[] = ['office', 'workshop', 'dungeon']
export type Via = 'laptop' | 'tv'
export type HoverTarget = 'laptop' | 'tv' | 'ada'
export type WorkshopApp = 'corrector' | 'prompts'
export interface WorkshopRoute {
  mission: string | null
  app: WorkshopApp | null
}

export interface Transition {
  to: ZoneId
  via: Via | null
  stage: 'flight' | 'fade'
}

export interface AppState {
  zone: ZoneId
  transition: Transition | null
  railTarget: number
  hasScrolled: boolean
  activeTopic: string | null
  menuOpen: boolean
  dialogue: DialogueState | null
  progress: Progress
  settings: Settings
  webgl: 'ok' | 'unavailable'
  webglLost: boolean
  readingMode: boolean
  reducedMotion: boolean
  sceneReady: boolean
  hovered: HoverTarget | null
  adaPokes: number
  expandOpen: boolean
  /** Time of day of the office. */
  phase: Phase
  /** The change of phase the 3D scene is animating, or null. */
  phaseTransition: PhaseTransition | null
  /** The decor stage (plants, books, frames, pendants) has loaded, or given up on what failed. */
  decorReady: boolean
  workshopRoute: WorkshopRoute

  requestZone: (to: ZoneId, via?: Via) => void
  transitionStep: () => void
  setRailTarget: (t: number) => void
  nudgeRail: (delta: number) => void
  openMenu: () => void
  closeMenu: () => void
  openTopic: (id: string) => void
  finishTyping: () => void
  advanceDialogue: () => void
  choose: (choice: Choice) => void
  closeTopic: () => void
  setSound: (on: boolean) => void
  setLang: (lang: string) => void
  setReadingMode: (on: boolean) => void
  setWebgl: (status: 'ok' | 'unavailable') => void
  reportWebglLost: () => void
  setSceneReady: (ready: boolean) => void
  setHovered: (target: HoverTarget | null) => void
  pokeAda: () => void
  setExpandOpen: (open: boolean) => void
  /** Next phase: animated over PHASE_SECONDS when the 3D office can show it, instant otherwise; ignored mid-transition. */
  advancePhase: () => void
  /** Instant change, without a transition. */
  setPhase: (phase: Phase) => void
  finishPhaseTransition: () => void
  setDecorReady: (ready: boolean) => void
  setWorkshopRoute: (route: WorkshopRoute) => void
  /** `knownIds`: the workshop's real missions, so a saved id of a removed mission never makes the workshop "done". */
  passWorkshopMission: (id: string, prompt: string, knownIds: readonly string[]) => void
  clearWorkshopPrompts: () => void
}

export interface StoreDeps {
  getTopic: (lang: string, id: string) => Topic | undefined
  storage?: StorageLike | null
  reducedMotion?: boolean
  /** Default 'day'. */
  initialPhase?: Phase
  /** Clock of the phase transitions, in milliseconds. Default performance.now(). */
  now?: () => number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function createAppStore(deps: StoreDeps): StoreApi<AppState> {
  const { getTopic, storage } = deps
  const clock = deps.now ?? (() => performance.now())
  return createStore<AppState>()((set, get) => {
    const topicFor = (id: string) => getTopic(get().settings.lang, id)
    const setProgress = (next: Progress) => {
      if (next === get().progress) return
      set({ progress: next })
      saveProgress(next, storage)
    }
    const setSettings = (next: Settings) => {
      set({ settings: next })
      saveSettings(next, storage)
    }
    // A flight is driven by the 3D camera. When 3D goes away mid-flight, finish it as a fade instead.
    const withoutFlight = (): Partial<Pick<AppState, 'transition'>> => {
      const t = get().transition
      return t?.stage === 'flight' ? { transition: { ...t, via: null, stage: 'fade' } } : {}
    }

    return {
      zone: 'office',
      transition: null,
      railTarget: 0,
      hasScrolled: false,
      activeTopic: null,
      menuOpen: false,
      dialogue: null,
      progress: loadProgress(storage),
      settings: loadSettings(storage),
      webgl: 'ok',
      webglLost: false,
      readingMode: false,
      reducedMotion: deps.reducedMotion ?? false,
      sceneReady: false,
      hovered: null,
      adaPokes: 0,
      expandOpen: false,
      phase: deps.initialPhase ?? 'day',
      phaseTransition: null,
      decorReady: false,
      workshopRoute: { mission: null, app: null },

      requestZone: (to, via) => {
        const s = get()
        if (s.transition || to === s.zone) return
        const canFly = via !== undefined && s.zone === 'office' && !s.reducedMotion && s.webgl === 'ok' && !s.readingMode
        set({ transition: { to, via: canFly ? via : null, stage: canFly ? 'flight' : 'fade' }, hovered: null })
      },
      transitionStep: () => {
        const t = get().transition
        if (!t) return
        if (t.stage === 'flight') {
          set({ transition: { ...t, stage: 'fade' } })
          return
        }
        const officeReset =
          t.to === 'office' ? { railTarget: 0, activeTopic: null, dialogue: null, menuOpen: false } : {}
        set({ zone: t.to, transition: null, expandOpen: false, ...officeReset })
      },
      setRailTarget: (t) => set({ railTarget: clamp01(t) }),
      nudgeRail: (delta) => {
        // Scrolling against an end stop changes nothing: it must not count as "has scrolled" (it would hide the hint).
        const current = get().railTarget
        const next = clamp01(current + delta)
        if (next !== current) set({ railTarget: next, hasScrolled: true })
      },
      openMenu: () => set({ menuOpen: true, railTarget: 1 }),
      closeMenu: () => set({ menuOpen: false }),
      openTopic: (id) => {
        const topic = topicFor(id)
        if (!topic) return
        set({ activeTopic: id, dialogue: engine.start(topic), menuOpen: false, railTarget: 1, expandOpen: false })
        const progress = get().progress
        if (!progress.firstVisitDone) setProgress({ ...progress, firstVisitDone: true })
      },
      finishTyping: () => {
        const dialogue = get().dialogue
        if (dialogue) set({ dialogue: engine.finishTyping(dialogue) })
      },
      advanceDialogue: () => {
        const dialogue = get().dialogue
        if (!dialogue) return
        const topic = topicFor(dialogue.topicId)
        if (!topic) return
        const result = engine.advance(dialogue, topic)
        set({ dialogue: result.state })
        if (result.completed) {
          setProgress(markSeen(get().progress, result.completed.topicId, result.completed.section))
        }
      },
      choose: (choice) => {
        if (choice.kind === 'next') {
          get().openTopic(choice.topicId)
          return
        }
        if (choice.kind === 'all') {
          get().closeTopic()
          return
        }
        const dialogue = get().dialogue
        const topic = dialogue ? topicFor(dialogue.topicId) : undefined
        if (dialogue && topic) set({ dialogue: engine.chooseDeeper(dialogue, topic) })
      },
      closeTopic: () => set({ activeTopic: null, dialogue: null, expandOpen: false, menuOpen: true }),
      setSound: (on) => setSettings({ ...get().settings, sound: on }),
      setLang: (lang) => setSettings({ ...get().settings, lang }),
      setReadingMode: (on) => set({ readingMode: on, hovered: null, ...(on ? withoutFlight() : {}) }),
      setWebgl: (status) => set({ webgl: status, ...(status === 'unavailable' ? withoutFlight() : {}) }),
      reportWebglLost: () => set({ webgl: 'unavailable', webglLost: true, readingMode: true, ...withoutFlight() }),
      setSceneReady: (ready) => set({ sceneReady: ready }),
      setHovered: (target) => set({ hovered: target }),
      pokeAda: () => set({ adaPokes: get().adaPokes + 1 }),
      setExpandOpen: (open) => set({ expandOpen: open }),
      advancePhase: () => {
        const s = get()
        const now = clock()
        // A transition older than its duration no longer blocks (3D stopped before it could finish it).
        if (s.phaseTransition && now - s.phaseTransition.startedAt < PHASE_SECONDS * 1000) return
        const to = nextPhase(s.phase)
        const animate = !s.reducedMotion && !s.readingMode && s.webgl === 'ok' && s.zone === 'office' && s.transition === null
        set({ phase: to, phaseTransition: animate ? { from: s.phase, to, startedAt: now } : null })
      },
      setPhase: (phase) => set({ phase, phaseTransition: null }),
      finishPhaseTransition: () => {
        if (get().phaseTransition) set({ phaseTransition: null })
      },
      setDecorReady: (ready) => set({ decorReady: ready }),
      setWorkshopRoute: (route) => {
        const current = get().workshopRoute
        if (current.mission === route.mission && current.app === route.app) return
        set({ workshopRoute: route })
      },
      passWorkshopMission: (id, prompt, knownIds) => setProgress(withMissionPassed(get().progress, id, prompt, knownIds)),
      clearWorkshopPrompts: () => setProgress(withoutWorkshopPrompts(get().progress)),
    }
  })
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** `?phase=` wins (read once, never written back to the address); otherwise the local time chooses. */
function initialPhase(): Phase {
  try {
    return parsePhaseParam(window.location.search) ?? phaseForTime(new Date())
  } catch {
    return 'day'
  }
}

export const appStore = createAppStore({
  getTopic: (lang, id) => getContent(lang).topicById.get(id),
  reducedMotion: prefersReducedMotion(),
  initialPhase: initialPhase(),
})

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}
