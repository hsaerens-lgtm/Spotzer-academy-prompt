import { initI18n, languages, missingKeys, resolveLang, resources } from './i18n'

test('finds missing nested keys', () => {
  const base = { a: 'x', b: { c: 'y', d: 'z' } }
  expect(missingKeys(base, { a: 'x', b: { c: 'y' } })).toEqual(['b.d'])
  expect(missingKeys(base, base)).toEqual([])
})

test('every language has every English key', () => {
  for (const lang of languages) {
    expect(missingKeys(resources.en.ui, resources[lang].ui)).toEqual([])
    expect(missingKeys(resources.en.visuals, resources[lang].visuals)).toEqual([])
  }
})

test('resolves unknown languages to English', () => {
  expect(resolveLang('en')).toBe('en')
  expect(resolveLang('xx')).toBe('en')
})

test('interpolates values', () => {
  const i18n = initI18n('en')
  expect(i18n.t('hud.progress', { seen: 3, total: 13 })).toBe('3/13 topics')
  expect(i18n.t('idle.tagline', { ns: 'visuals' })).toBe('Learn to talk to AI')
})
