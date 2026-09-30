import { makeTopic } from '../test/fixtures'
import { buildContent } from './load'

const chapters = [{ id: 'basics', title: 'The basics', topics: ['alpha', 'beta'] }]

describe('buildContent', () => {
  it('orders topics by chapter and indexes them', () => {
    const content = buildContent('en', chapters, {
      beta: makeTopic({ id: 'beta' }),
      alpha: makeTopic({ id: 'alpha', next: 'beta' }),
    })
    expect(content.issues).toEqual([])
    expect(content.topics.map((t) => t.id)).toEqual(['alpha', 'beta'])
    expect(content.topicById.get('beta')?.id).toBe('beta')
  })

  it('drops invalid topics and reports why', () => {
    const content = buildContent('en', chapters, {
      alpha: makeTopic({ basics: [{ say: 'x'.repeat(221) }] }),
      beta: makeTopic({ id: 'gamma' }),
    })
    expect(content.topics).toEqual([])
    expect(content.issues.map((i) => i.path)).toEqual(['en/topics/alpha.json', 'en/topics/beta.json'])
    expect(content.issues[1].message).toContain('does not match file name')
  })

  it('rejects emoji in text', () => {
    const content = buildContent('en', [{ id: 'basics', title: 'B', topics: ['alpha'] }], {
      alpha: makeTopic({ title: 'Alpha \u{1F680}' }),
    })
    expect(content.topics).toEqual([])
    expect(content.issues[0].message).toContain('No emoji allowed')
  })

  it('reports chapter problems', () => {
    const content = buildContent('en', [{ id: 'basics', title: 'B', topics: ['alpha', 'ghost'] }], {
      alpha: makeTopic({ chapter: 'other' }),
      orphan: makeTopic({ id: 'orphan' }),
    })
    const messages = content.issues.map((i) => i.message)
    expect(messages).toContain('chapter "basics" lists unknown topic "ghost"')
    expect(messages).toContain('topic "alpha" says chapter "other" but is listed in "basics"')
    expect(messages).toContain('topic "orphan" is not listed in any chapter')
    expect(content.topics.map((t) => t.id)).toEqual(['alpha'])
  })

  it('reports a broken chapters file', () => {
    const content = buildContent('en', { nope: true }, {})
    expect(content.issues[0].path).toBe('en/chapters.json')
    expect(content.chapters).toEqual([])
  })
})
