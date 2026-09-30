import { parseScreenRef } from './schema'
import type { ContentIssue, LangContent } from './load'

export function validateContent(
  content: LangContent,
  manifest: Readonly<Record<string, { readonly steps: number }>>,
): ContentIssue[] {
  const issues = [...content.issues]
  for (const topic of content.topics) {
    const path = `${content.lang}/topics/${topic.id}.json`
    if (topic.next !== null && !content.topicById.has(topic.next)) {
      issues.push({ path, message: `next "${topic.next}" is not a known topic` })
    }
    if (!topic.basics[0].screen) issues.push({ path, message: 'the first basics beat must set a screen' })
    for (const [section, beats] of [
      ['basics', topic.basics],
      ['deeper', topic.deeper],
    ] as const) {
      beats.forEach((beat, index) => {
        if (!beat.screen) return
        const { visualId, step } = parseScreenRef(beat.screen)
        const meta = manifest[visualId]
        if (!meta) issues.push({ path, message: `${section}[${index}]: unknown visual "${visualId}"` })
        else if (step < 1 || step > meta.steps) {
          issues.push({ path, message: `${section}[${index}]: step ${step} out of range 1-${meta.steps} for "${visualId}"` })
        }
      })
    }
  }
  return issues
}
