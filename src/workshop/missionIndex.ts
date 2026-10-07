import { missionIndexSchema } from './model'

/**
 * The mission index of every language: a few ids and levels, small enough for the office's first load, where the
 * welcome bar counts the passed missions that still exist. The missions themselves stay in the workshop's lazy chunk.
 */
export const missionIndexFiles = import.meta.glob<unknown>('/content/*/workshop/missions.json', { eager: true, import: 'default' })

const cache = new Map<string, readonly string[]>()

/** The mission ids listed for a language (English when it has no workshop); none when the index is invalid. */
export function listedMissionIds(lang: string): readonly string[] {
  let ids = cache.get(lang)
  if (!ids) {
    const raw = missionIndexFiles[`/content/${lang}/workshop/missions.json`] ?? missionIndexFiles['/content/en/workshop/missions.json']
    const parsed = missionIndexSchema.safeParse(raw)
    ids = parsed.success ? parsed.data.map((entry) => entry.id) : []
    cache.set(lang, ids)
  }
  return ids
}
