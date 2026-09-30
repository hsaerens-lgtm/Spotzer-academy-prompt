import { chaptersSchema, topicSchema, type Chapter, type Topic } from './schema'

export interface ContentIssue {
  path: string
  message: string
}

export interface LangContent {
  lang: string
  chapters: Chapter[]
  topics: Topic[]
  topicById: ReadonlyMap<string, Topic>
  issues: ContentIssue[]
}

const topicFiles = import.meta.glob<unknown>('/content/*/topics/*.json', { eager: true, import: 'default' })
const chapterFiles = import.meta.glob<unknown>('/content/*/chapters.json', { eager: true, import: 'default' })

const langOf = (path: string) => path.split('/')[2]
const fileId = (path: string) => path.split('/').pop()!.replace(/\.json$/, '')

export function buildContent(lang: string, rawChapters: unknown, rawTopics: Record<string, unknown>): LangContent {
  const issues: ContentIssue[] = []
  const topicPath = (id: string) => `${lang}/topics/${id}.json`

  const parsedChapters = chaptersSchema.safeParse(rawChapters)
  if (!parsedChapters.success) issues.push({ path: `${lang}/chapters.json`, message: parsedChapters.error.message })
  const chapterList = parsedChapters.success ? parsedChapters.data : []

  const valid = new Map<string, Topic>()
  for (const [id, raw] of Object.entries(rawTopics)) {
    const parsed = topicSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push({ path: topicPath(id), message: parsed.error.message })
      continue
    }
    if (parsed.data.id !== id) {
      issues.push({ path: topicPath(id), message: `id "${parsed.data.id}" does not match file name "${id}"` })
      continue
    }
    valid.set(id, parsed.data)
  }

  const listed = new Set<string>()
  const chapters: Chapter[] = chapterList.map((chapter) => {
    const topics: string[] = []
    for (const id of chapter.topics) {
      if (listed.has(id)) {
        issues.push({ path: `${lang}/chapters.json`, message: `topic "${id}" is listed more than once` })
        continue
      }
      listed.add(id)
      const topic = valid.get(id)
      if (!topic) {
        if (!(id in rawTopics)) {
          issues.push({ path: `${lang}/chapters.json`, message: `chapter "${chapter.id}" lists unknown topic "${id}"` })
        }
        continue
      }
      if (topic.chapter !== chapter.id) {
        issues.push({
          path: topicPath(id),
          message: `topic "${id}" says chapter "${topic.chapter}" but is listed in "${chapter.id}"`,
        })
      }
      topics.push(id)
    }
    return { ...chapter, topics }
  })

  for (const id of valid.keys()) {
    if (!listed.has(id)) issues.push({ path: topicPath(id), message: `topic "${id}" is not listed in any chapter` })
  }

  const topics = chapters.flatMap((chapter) => chapter.topics.map((id) => valid.get(id)!))
  return { lang, chapters, topics, topicById: new Map(topics.map((t) => [t.id, t])), issues }
}

export const contentLanguages = [...new Set(Object.keys(chapterFiles).map(langOf))].sort()

const cache = new Map<string, LangContent>()

export function getContent(lang: string): LangContent {
  const resolved = contentLanguages.includes(lang) ? lang : 'en'
  let content = cache.get(resolved)
  if (!content) {
    const rawTopics: Record<string, unknown> = {}
    for (const [path, raw] of Object.entries(topicFiles)) {
      if (langOf(path) === resolved) rawTopics[fileId(path)] = raw
    }
    content = buildContent(resolved, chapterFiles[`/content/${resolved}/chapters.json`], rawTopics)
    cache.set(resolved, content)
  }
  return content
}
