import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { WorkshopContent } from '../../workshop/content'
import { assemblePrompt, evaluate, type Evaluation } from '../../workshop/engine/evaluate'
import type { ApiError, BlockType, CorrectRequest, CorrectorReport, Mission, PromptInput } from '../../workshop/model'

export type WorkshopView = 'missions' | 'prompts' | 'corrector'

export interface Attempt {
  /** Ids increase across the whole workshop (one counter for every mission); 0 is the starter prompt of a fix mission. */
  id: number
  input: PromptInput
  evaluation: Evaluation
}

export interface MissionSession {
  draft: PromptInput
  overrides: string[]
  first: Attempt | null
  last: Attempt | null
  /** Tips Ada has given since the last test: each tip appears at most once per attempt, so a test clears them. */
  tipsShown: string[]
  tipsMuted: boolean
  addedBlocks: BlockType[]
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

export interface CorrectorApi {
  health(): Promise<ApiResult<{ corrector: boolean }>>
  correct(body: CorrectRequest): Promise<ApiResult<CorrectorReport>>
  run(prompt: string): Promise<ApiResult<{ answer: string }>>
}

export interface RunState {
  status: 'idle' | 'running' | 'done' | 'error'
  original: string | null
  improved: string | null
  error: ApiError | null
}

export interface CorrectorState {
  health: 'unknown' | 'checking' | 'online' | 'offline'
  prompt: string
  purpose: string
  status: 'idle' | 'checking' | 'done' | 'error'
  error: ApiError | null
  report: CorrectorReport | null
  /** The prompt the report is about (what "Run both" runs as "Your prompt"). */
  checkedPrompt: string | null
  /** Increases with each successful check: the builder's run key. */
  checks: number
  /**
   * The check whose report is revealed (its building was seen to its end); 0 before any. Kept here rather than in the
   * view, which is unmounted while another program is open: coming back shows the report without building it again.
   */
  revealedCheck: number
  run: RunState
}

export interface WorkshopState {
  content: WorkshopContent
  sessions: Record<string, MissionSession>
  attempts: number
  announcement: string
  /** Counts the announcements, so the same words said twice still reach the live region as a new message. */
  announcements: number
  corrector: CorrectorState
  setBlock: (missionId: string, type: BlockType, value: string) => void
  addBlock: (missionId: string, type: BlockType) => void
  setText: (missionId: string, value: string) => void
  resetDraft: (missionId: string) => void
  test: (missionId: string) => Attempt | null
  alreadyThere: (missionId: string, detailId: string) => void
  markTipShown: (missionId: string, detailId: string) => void
  muteTips: (missionId: string) => void
  announce: (message: string) => void
  checkHealth: () => Promise<void>
  setCorrectorPrompt: (value: string) => void
  setCorrectorPurpose: (value: string) => void
  checkPrompt: () => Promise<void>
  /** The building of check `check` was seen to its end: reveal its report, if it is still the latest one. */
  revealReport: (check: number) => void
  runBoth: () => Promise<void>
}

export interface WorkshopDeps {
  content: WorkshopContent
  passMission: (id: string, prompt: string) => void
  api: CorrectorApi
}

const IDLE_RUN: RunState = { status: 'idle', original: null, improved: null, error: null }

function initialDraft(mission: Mission): PromptInput {
  if (mission.mode === 'blocks') return { mode: 'blocks', blocks: {} }
  if (mission.mode === 'free') return { mode: 'free', text: '' }
  return { mode: 'fix', text: mission.starter ?? '' }
}

function isInitialDraft(draft: PromptInput, mission: Mission): boolean {
  const initial = initialDraft(mission)
  if (draft.mode === 'blocks') return initial.mode === 'blocks' && Object.keys(draft.blocks).length === 0
  return initial.mode !== 'blocks' && draft.text === initial.text
}

/** An api call that rejects counts as an unavailable server, so no state is ever left waiting for it. */
async function settle<T>(call: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  try {
    return await call()
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

function initialSession(mission: Mission): MissionSession {
  const draft = initialDraft(mission)
  const starter: Attempt | null = mission.mode === 'fix' ? { id: 0, input: draft, evaluation: evaluate(mission, draft) } : null
  return { draft, overrides: [], first: starter, last: starter, tipsShown: [], tipsMuted: false, addedBlocks: [] }
}

export function createWorkshopStore({ content, passMission, api }: WorkshopDeps): StoreApi<WorkshopState> {
  return createStore<WorkshopState>()((set, get) => {
    const update = (missionId: string, change: (session: MissionSession, mission: Mission) => MissionSession) => {
      const mission = content.missionById.get(missionId)
      const session = get().sessions[missionId]
      if (!mission || !session) return
      const next = change(session, mission)
      if (next !== session) set({ sessions: { ...get().sessions, [missionId]: next } })
    }
    const record = (missionId: string, input: PromptInput, overrides: string[], tipsShown: string[]): Attempt | null => {
      const mission = content.missionById.get(missionId)
      const session = get().sessions[missionId]
      if (!mission || !session) return null
      const attempt: Attempt = { id: get().attempts + 1, input, evaluation: evaluate(mission, input, new Set(overrides)) }
      set({
        attempts: attempt.id,
        sessions: { ...get().sessions, [missionId]: { ...session, overrides, tipsShown, last: attempt, first: session.first ?? attempt } },
      })
      if (attempt.evaluation.passed) passMission(missionId, assemblePrompt(input, content.labels))
      return attempt
    }
    const patchCorrector = (change: Partial<CorrectorState>) => set({ corrector: { ...get().corrector, ...change } })

    return {
      content,
      sessions: Object.fromEntries(content.missions.map((mission) => [mission.id, initialSession(mission)])),
      attempts: 0,
      announcement: '',
      announcements: 0,
      corrector: {
        health: 'unknown',
        prompt: '',
        purpose: '',
        status: 'idle',
        error: null,
        report: null,
        checkedPrompt: null,
        checks: 0,
        revealedCheck: 0,
        run: IDLE_RUN,
      },

      setBlock: (missionId, type, value) =>
        update(missionId, (session) =>
          session.draft.mode === 'blocks' ? { ...session, draft: { mode: 'blocks', blocks: { ...session.draft.blocks, [type]: value } } } : session,
        ),
      addBlock: (missionId, type) =>
        update(missionId, (session) => (session.addedBlocks.includes(type) ? session : { ...session, addedBlocks: [...session.addedBlocks, type] })),
      setText: (missionId, value) =>
        update(missionId, (session) => (session.draft.mode === 'blocks' ? session : { ...session, draft: { mode: session.draft.mode, text: value } })),
      resetDraft: (missionId) =>
        update(missionId, (session, mission) => (isInitialDraft(session.draft, mission) ? session : { ...session, draft: initialDraft(mission) })),
      test: (missionId) => {
        const session = get().sessions[missionId]
        // A test ends the attempt Ada was advising on: the next one may hear the same tips again.
        return session ? record(missionId, session.draft, session.overrides, []) : null
      },
      alreadyThere: (missionId, detailId) => {
        const session = get().sessions[missionId]
        if (!session) return
        // Unlike test(), this keeps tipsShown: it re-evaluates the last attempt and starts no new typing round.
        const overrides = session.overrides.includes(detailId) ? session.overrides : [...session.overrides, detailId]
        if (session.last && session.last.id > 0) record(missionId, session.last.input, overrides, session.tipsShown)
        else update(missionId, (current) => ({ ...current, overrides }))
      },
      markTipShown: (missionId, detailId) =>
        update(missionId, (session) => (session.tipsShown.includes(detailId) ? session : { ...session, tipsShown: [...session.tipsShown, detailId] })),
      muteTips: (missionId) => update(missionId, (session) => (session.tipsMuted ? session : { ...session, tipsMuted: true })),
      announce: (message) => set({ announcement: message, announcements: get().announcements + 1 }),

      checkHealth: async () => {
        const status = get().corrector.health
        if (status === 'checking' || status === 'online') return
        patchCorrector({ health: 'checking' })
        const result = await settle(() => api.health())
        patchCorrector({ health: result.ok && result.data.corrector ? 'online' : 'offline' })
      },
      setCorrectorPrompt: (value) => patchCorrector({ prompt: value }),
      setCorrectorPurpose: (value) => patchCorrector({ purpose: value }),
      checkPrompt: async () => {
        const { prompt, purpose, status } = get().corrector
        if (status === 'checking' || prompt.trim() === '') return
        patchCorrector({ status: 'checking', error: null })
        const result = await settle(() => api.correct({ prompt, purpose: purpose.trim() || undefined, lang: 'en' }))
        if (result.ok) {
          patchCorrector({ status: 'done', report: result.data, checkedPrompt: prompt.trim(), checks: get().corrector.checks + 1, run: IDLE_RUN })
        } else {
          patchCorrector({ status: 'error', error: result.error })
        }
      },
      revealReport: (check) => {
        const { checks, revealedCheck } = get().corrector
        // Only the building of the latest report may reveal it: one still finishing for an older report is ignored.
        if (check === checks && check !== revealedCheck) patchCorrector({ revealedCheck: check })
      },
      runBoth: async () => {
        const { report, checkedPrompt, run, status, checks } = get().corrector
        if (!report || !checkedPrompt || run.status === 'running' || status === 'checking') return
        patchCorrector({ run: { ...IDLE_RUN, status: 'running' } })
        const [original, improved] = await Promise.all([settle(() => api.run(checkedPrompt)), settle(() => api.run(report.improvedPrompt))])
        // A re-check made a newer report (and reset the run) while these answers were on their way: they are about the old one.
        if (get().corrector.checks !== checks) return
        if (original.ok && improved.ok) {
          patchCorrector({ run: { status: 'done', original: original.data.answer, improved: improved.data.answer, error: null } })
        } else {
          const error = !original.ok ? original.error : !improved.ok ? improved.error : 'error'
          patchCorrector({ run: { ...IDLE_RUN, status: 'error', error } })
        }
      },
    }
  })
}

const WorkshopStoreContext = createContext<StoreApi<WorkshopState> | null>(null)
export const WorkshopStoreProvider = WorkshopStoreContext.Provider

export function useWorkshopStore(): StoreApi<WorkshopState> {
  const store = useContext(WorkshopStoreContext)
  if (!store) throw new Error('useWorkshop must be used inside a WorkshopStoreProvider')
  return store
}

export function useWorkshop<T>(selector: (state: WorkshopState) => T): T {
  return useStore(useWorkshopStore(), selector)
}
