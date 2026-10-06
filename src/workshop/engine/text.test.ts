import { compilePattern, findFirst, normalizeText, sentenceSpan } from './text'

const find = (text: string, ...patterns: string[]) => findFirst(normalizeText(text), patterns)
const slice = (text: string, ...patterns: string[]) => {
  const span = find(text, ...patterns)
  return span ? text.slice(span.start, span.end) : null
}
const sentence = (text: string, ...patterns: string[]) => {
  const found = sentenceSpan(text, find(text, ...patterns)!)
  return text.slice(found.start, found.end)
}

test('normalizing lowercases, strips accents, unifies apostrophes and collapses spaces', () => {
  expect(normalizeText("  Caf\u00E9  au\n\n LAIT \u2019s ").text).toBe("cafe au lait 's")
})

test('the map points back to the original characters', () => {
  const source = 'H\u00E9  Mart\u00EDn'
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
  expect(slice('for instance, e.g. a caf\u00E9', 'e.g.')).toBe('e.g.')
  expect(slice('Open 24/7 all year', '24/7')).toBe('24/7')
  expect(slice("Please don\u2019t blame them", "don't")).toBe("don\u2019t")
})

test('regular expression characters in patterns are matched literally', () => {
  expect(findFirst(normalizeText('I use c++ daily'), ['c++'])).toEqual({ start: 6, end: 9 })
  expect(slice('Use (a) or b', '(a)')).toBe('(a)')
  expect(find('Use a or b', '(a)')).toBeNull()
  expect(find('axb', 'a.b')).toBeNull()
  expect(slice('the a.b file', 'a.b')).toBe('a.b')
})

test('multi-word patterns survive line breaks and extra spaces', () => {
  expect(slice('Launch is next\n   week', 'next week')).toBe('next\n   week')
})

test('the earliest match among patterns wins', () => {
  expect(slice('Friendly and short', 'short', 'friendly')).toBe('Friendly')
})

test('accented text maps back to the accented original', () => {
  expect(slice("\u00C9crire \u00E0 Mart\u00EDn\u2019s bakery", 'martin*')).toBe('Mart\u00EDn')
})

test('compiled patterns are cached', () => {
  expect(compilePattern('photo*')).toBe(compilePattern('photo*'))
})

test('a span grows to its whole sentence', () => {
  expect(sentence('You are a writer. The client is Martin. Be brief.', 'martin')).toBe('The client is Martin.')
})

test('a sentence also stops at line breaks', () => {
  expect(sentence('Role: writer\nClient: Martin\nTone: warm', 'martin')).toBe('Client: Martin')
})

test('periods in decimals do not end sentences', () => {
  expect(sentence('The price is 3.5 euros. Ok.', 'euros')).toBe('The price is 3.5 euros.')
})

test('periods in filenames do not end sentences', () => {
  expect(sentence('Open config.json now. Then stop.', 'now')).toBe('Open config.json now.')
})

test('straight closing quotes after the final punctuation belong to the sentence they close', () => {
  const text = 'He said "stop." Then Martin left.'
  expect(sentence(text, 'martin')).toBe('Then Martin left.')
  expect(sentence(text, 'stop')).toBe('He said "stop."')
})

test('curly closing quotes after the final punctuation belong to the sentence they close', () => {
  const text = 'He said \u201Cstop.\u201D Then Martin left.'
  expect(sentence(text, 'martin')).toBe('Then Martin left.')
  expect(sentence(text, 'stop')).toBe('He said \u201Cstop.\u201D')
})

test('closing parentheses after the final punctuation belong to the sentence they close', () => {
  const text = 'See (the doc.) Then Martin left.'
  expect(sentence(text, 'martin')).toBe('Then Martin left.')
  expect(sentence(text, 'doc')).toBe('See (the doc.)')
})

test('an opening quote at the start of a sentence is kept', () => {
  expect(sentence('"Be brief," said Martin.', 'martin')).toBe('"Be brief," said Martin.')
  expect(sentence('Intro.\n"Quoted line" here.', 'here')).toBe('"Quoted line" here.')
  expect(sentence('Intro. "Quoted line" here.', 'here')).toBe('"Quoted line" here.')
})

test('a sentence never starts after the passage it contains', () => {
  const text = '"hi"'
  const span = find(text, '"hi"')!
  expect(sentenceSpan(text, span)).toEqual(span)
})
