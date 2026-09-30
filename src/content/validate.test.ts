import { makeTopic } from '../test/fixtures'
import { visualManifest } from '../visuals/manifest'
import { buildContent } from './load'
import { validateContent } from './validate'

function contentWith(topics: ReturnType<typeof makeTopic>[]) {
  const chapters = [{ id: 'basics', title: 'B', topics: topics.map((t) => t.id) }]
  return buildContent('en', chapters, Object.fromEntries(topics.map((t) => [t.id, t])))
}

test('accepts a coherent topic', () => {
  expect(validateContent(contentWith([makeTopic()]), visualManifest)).toEqual([])
})

test('flags an unknown next topic', () => {
  const issues = validateContent(contentWith([makeTopic({ next: 'nowhere' })]), visualManifest)
  expect(issues[0].message).toBe('next "nowhere" is not a known topic')
})

test('flags unknown visuals and out-of-range steps', () => {
  const topic = makeTopic({
    basics: [{ say: 'a', screen: 'what-is-ai:9' }, { say: 'b', screen: 'nope:1' }],
  })
  const messages = validateContent(contentWith([topic]), visualManifest).map((i) => i.message)
  expect(messages).toContain('basics[0]: step 9 out of range 1-4 for "what-is-ai"')
  expect(messages).toContain('basics[1]: unknown visual "nope"')
})

test('requires the first basics beat to set a screen', () => {
  const topic = makeTopic({ basics: [{ say: 'no screen' }] })
  const messages = validateContent(contentWith([topic]), visualManifest).map((i) => i.message)
  expect(messages).toContain('the first basics beat must set a screen')
})
