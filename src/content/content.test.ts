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
