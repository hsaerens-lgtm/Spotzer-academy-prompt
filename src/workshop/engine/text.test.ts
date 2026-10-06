import { compilePattern, findFirst, normalizeText, sentenceSpan } from './text'

const find = (text: string, ...patterns: string[]) => findFirst(normalizeText(text), patterns)
const slice = (text: string, ...patterns: string[]) => {
  const span = find(text, ...patterns)
  return span ? text.slice(span.start, span.end) : null
}

test('normalizing lowercases, strips accents, unifies apostrophes and collapses spaces', () => {
  expect(normalizeText("  Café  au\n\n LAIT ’s ").text).toBe("cafe au lait 's")
})

test('the map points back to the original characters', () => {
  const source = 'Hé  Martín'
  const normalized = normalizeText(source)
  expect(normalized.text).toBe('he martin')
  expect(source[normalized.map[3]]).toBe('M')
})

test('patterns respect word boundaries', () => {
  expect(find('Send an email', 'mail')).toBeNull()
  expect(slice('Send an email', 'email')).toBe('email')
})

test('a trailing star matches the rest of the word, not a word that ends with it', () => {
  expect(slice('The photos arrived', 'photo*')).toBe('photos')
  expect(find('a telephoto lens', 'photo*')).toBeNull()
})

test('punctuation and numbers inside patterns are matched literally', () => {
  expect(slice('Get 15% off now', '15%')).toBe('15%')
  expect(slice('for instance, e.g. a café', 'e.g.')).toBe('e.g.')
  expect(slice('Open 24/7 all year', '24/7')).toBe('24/7')
  expect(slice("Please don’t blame them", "don’t")).toBe("don’t")
})

test('multi-word patterns survive line breaks and extra spaces', () => {
  expect(slice('Launch is next\n   week', 'next week')).toBe('next\n   week')
})

test('the earliest match among patterns wins', () => {
  expect(slice('Friendly and short', 'short', 'friendly')).toBe('Friendly')
})

test('accented text maps back to the accented original', () => {
  expect(slice("Écrire à Martín’s bakery", 'martin*')).toBe('Martín')
})

test('compiled patterns are cached', () => {
  expect(compilePattern('photo*')).toBe(compilePattern('photo*'))
})

test('a span grows to its whole sentence', () => {
  const text = 'You are a writer. The client is Martin. Be brief.'
  const span = find(text, 'martin')!
  const sentence = sentenceSpan(text, span)
  expect(text.slice(sentence.start, sentence.end)).toBe('The client is Martin.')
})

test('a sentence also stops at line breaks', () => {
  const text = 'Role: writer\nClient: Martin\nTone: warm'
  const sentence = sentenceSpan(text, find(text, 'martin')!)
  expect(text.slice(sentence.start, sentence.end)).toBe('Client: Martin')
})

test('periods in decimals do not end sentences', () => {
  const text = 'The price is 3.5 euros. Ok.'
  const span = find(text, 'euros')!
  const sentence = sentenceSpan(text, span)
  expect(text.slice(sentence.start, sentence.end)).toBe('The price is 3.5 euros.')
})

test('periods in filenames do not end sentences', () => {
  const text = 'Open config.json now. Then stop.'
  const span = find(text, 'now')!
  const sentence = sentenceSpan(text, span)
  expect(text.slice(sentence.start, sentence.end)).toBe('Open config.json now.')
})
