import { visualManifest } from '../visuals/manifest'
import { contentLanguages, getContent } from './load'
import { validateContent } from './validate'

describe('shipped content', () => {
  it('includes English', () => {
    expect(contentLanguages).toContain('en')
  })

  it.each(contentLanguages)('%s has no issues', (lang) => {
    expect(validateContent(getContent(lang), visualManifest)).toEqual([])
  })

  it.each(contentLanguages)('%s has the same topics as English', (lang) => {
    expect(getContent(lang).topics.map((t) => t.id)).toEqual(getContent('en').topics.map((t) => t.id))
  })

  it('falls back to English for an unknown language', () => {
    expect(getContent('xx').lang).toBe('en')
  })
})

const SPEC_ORDER = [
  'what-is-ai',
  'generative-ai',
  'llm',
  'tokens',
  'context-window',
  'hallucinations',
  'prompt',
  'multimodal',
  'agents',
  'tools',
  'skills',
  'mcp',
  'ai-safety-at-work',
]

test('the 13 topics exist in the agreed order', () => {
  expect(getContent('en').topics.map((topic) => topic.id)).toEqual(SPEC_ORDER)
})

test('each topic leads to the next one, the last one ends the path', () => {
  const topics = getContent('en').topics
  topics.forEach((topic, index) => expect(topic.next).toBe(topics[index + 1]?.id ?? null))
})

test('every topic has at least four basics beats and three deeper beats', () => {
  for (const topic of getContent('en').topics) {
    expect(topic.basics.length).toBeGreaterThanOrEqual(4)
    expect(topic.deeper.length).toBeGreaterThanOrEqual(3)
  }
})
