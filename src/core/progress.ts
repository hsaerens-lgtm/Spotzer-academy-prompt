import { z } from 'zod'

export const PROGRESS_KEY = 'athena-prompt-academy:v1'
export const SETTINGS_KEY = 'athena-prompt-academy:settings'

const progressSchema = z.object({
  version: z.literal(1),
  topicsSeen: z.array(z.string()),
  deeperSeen: z.array(z.string()),
  workshopDone: z.boolean(),
  dungeon: z.object({ passed: z.boolean(), bestScore: z.number() }).nullable(),
  firstVisitDone: z.boolean(),
})
export type Progress = z.infer<typeof progressSchema>

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
