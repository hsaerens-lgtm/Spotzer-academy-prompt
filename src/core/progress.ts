import { z } from 'zod'

export const PROGRESS_KEY = 'athena-prompt-academy:v1'
export const SETTINGS_KEY = 'athena-prompt-academy:settings'

const workshopSchema = z.object({ passed: z.array(z.string()), prompts: z.record(z.string(), z.string()) })

const floorResultSchema = z.object({ passed: z.boolean(), bestScore: z.number(), passedAt: z.string().optional() })
/**
 * Spec 3, §4.5: floor 1 at the top level (saved before the expert floor existed), the expert floor inside. A malformed
 * expert result is dropped alone, like `workshop`.
 */
const dungeonSchema = floorResultSchema.extend({ expert: floorResultSchema.nullable().optional().catch(undefined) })

const progressSchema = z.object({
  version: z.literal(1),
  topicsSeen: z.array(z.string()),
  deeperSeen: z.array(z.string()),
  workshopDone: z.boolean(),
  dungeon: dungeonSchema.nullable(),
  firstVisitDone: z.boolean(),
  /**
   * Added by the workshop (spec 2); progress saved before it simply has no such key. A malformed value is dropped
   * alone: it must not cost the office progress around it.
   */
  workshop: workshopSchema.optional().catch(undefined),
})
export type Progress = z.infer<typeof progressSchema>
export type WorkshopProgress = z.infer<typeof workshopSchema>

const settingsSchema = z.object({ sound: z.boolean(), lang: z.string() })
export type Settings = z.infer<typeof settingsSchema>

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export const emptyProgress = (): Progress => ({
  version: 1,
  topicsSeen: [],
  deeperSeen: [],
  workshopDone: false,
  dungeon: null,
  firstVisitDone: false,
})

export const defaultSettings = (): Settings => ({ sound: true, lang: 'en' })

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function read<T>(key: string, schema: z.ZodType<T>, fallback: () => T, storage: StorageLike | null): T {
  if (!storage) return fallback()
  try {
    const raw = storage.getItem(key)
    if (raw === null) return fallback()
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : fallback()
  } catch {
    return fallback()
  }
}

function write(key: string, value: unknown, storage: StorageLike | null): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadProgress = (storage: StorageLike | null = browserStorage()) =>
  read(PROGRESS_KEY, progressSchema, emptyProgress, storage)
export const saveProgress = (progress: Progress, storage: StorageLike | null = browserStorage()) =>
  write(PROGRESS_KEY, progress, storage)
export const loadSettings = (storage: StorageLike | null = browserStorage()) =>
  read(SETTINGS_KEY, settingsSchema, defaultSettings, storage)
export const saveSettings = (settings: Settings, storage: StorageLike | null = browserStorage()) =>
  write(SETTINGS_KEY, settings, storage)

export function markSeen(progress: Progress, topicId: string, section: 'basics' | 'deeper'): Progress {
  const key = section === 'basics' ? 'topicsSeen' : 'deeperSeen'
  if (progress[key].includes(topicId)) return progress
  return { ...progress, [key]: [...progress[key], topicId] }
}

/** The workshop part of the progress, empty when absent. Returns a new object when absent: not for useApp selectors. */
export const workshopProgress = (progress: Progress): WorkshopProgress => progress.workshop ?? { passed: [], prompts: {} }

/**
 * Records a passed mission and its prompt. `knownIds` are the workshop's real missions: the saved list may still hold
 * the id of a mission removed or renamed since (spec 4.6), which must never count towards workshopDone (saved for good).
 */
export function withMissionPassed(progress: Progress, id: string, prompt: string, knownIds: readonly string[]): Progress {
  const current = workshopProgress(progress)
  const already = current.passed.includes(id)
  if (already && current.prompts[id] === prompt) return progress
  const passed = already ? current.passed : [...current.passed, id]
  return {
    ...progress,
    workshop: { passed, prompts: { ...current.prompts, [id]: prompt } },
    workshopDone: progress.workshopDone || (knownIds.length > 0 && knownIds.every((known) => passed.includes(known))),
  }
}

export type DungeonFloor = 1 | 2
export type DungeonProgress = z.infer<typeof dungeonSchema>
type FloorResult = z.infer<typeof floorResultSchema>

/** A floor passed: the best score stays, with the date it was made. The expert floor needs floor 1 (spec 3, §4.5). */
export function withDungeonPassed(progress: Progress, floor: DungeonFloor, score: number, date: string): Progress {
  const best = (previous: FloorResult | null | undefined): FloorResult =>
    previous && previous.bestScore >= score
      ? { passed: true, bestScore: previous.bestScore, passedAt: previous.passedAt ?? date }
      : { passed: true, bestScore: score, passedAt: date }
  const dungeon = progress.dungeon
  if (floor === 1) return { ...progress, dungeon: { ...best(dungeon), expert: dungeon?.expert ?? null } }
  if (!dungeon?.passed) return progress
  return { ...progress, dungeon: { ...dungeon, expert: best(dungeon.expert) } }
}

export function withoutWorkshopPrompts(progress: Progress): Progress {
  const current = workshopProgress(progress)
  if (Object.keys(current.prompts).length === 0) return progress
  return { ...progress, workshop: { ...current, prompts: {} } }
}
