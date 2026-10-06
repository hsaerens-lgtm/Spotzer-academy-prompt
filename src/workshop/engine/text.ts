export interface NormalizedText {
  text: string
  /** map[i] is the index, in the original string, of normalized character i. */
  map: number[]
}

/** Indices in the ORIGINAL text; `end` is exclusive. */
export interface Span {
  start: number
  end: number
}

const APOSTROPHES = /[\u2018\u2019\u02BC`]/g
const MARKS = /\p{M}/gu
const SPACE = /\s/u
const WORD_CHAR = /[\p{L}\p{N}]/u

/** Lowercase, accents removed, apostrophes unified, whitespace runs collapsed — with a map back to the original. */
export function normalizeText(source: string): NormalizedText {
  let text = ''
  const map: number[] = []
  let lastWasSpace = true
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (SPACE.test(char)) {
      if (!lastWasSpace) {
        text += ' '
        map.push(i)
        lastWasSpace = true
      }
      continue
    }
    const folded = char.normalize('NFD').replace(MARKS, '').toLowerCase().replace(APOSTROPHES, "'")
    for (const out of folded) {
      text += out
      map.push(i)
    }
    lastWasSpace = false
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1)
    map.pop()
  }
  return { text, map }
}

const cache = new Map<string, RegExp>()
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\/]/g, '\$&')
const WORD = '[\\p{L}\\p{N}]'

/** Plain-word pattern → regular expression on normalized text. A trailing `*` matches the rest of the word. */
export function compilePattern(pattern: string): RegExp {
  const cached = cache.get(pattern)
  if (cached) return cached
  const wildcard = pattern.endsWith('*')
  const body = normalizeText(wildcard ? pattern.slice(0, -1) : pattern).text
  const startGuard = WORD_CHAR.test(body[0] ?? '') ? `(?<!${WORD})` : ''
  const endGuard = wildcard ? `${WORD}*(?!${WORD})` : WORD_CHAR.test(body[body.length - 1] ?? '') ? `(?!${WORD})` : ''
  const regex = new RegExp(`${startGuard}${escape(body)}${endGuard}`, 'u')
  cache.set(pattern, regex)
  return regex
}

/** The earliest passage matching any of the patterns, as a span of the original text. */
export function findFirst(source: NormalizedText, patterns: readonly string[]): Span | null {
  let best: { index: number; length: number } | null = null
  for (const pattern of patterns) {
    const match = compilePattern(pattern).exec(source.text)
    if (match && match[0].length > 0 && (best === null || match.index < best.index)) {
      best = { index: match.index, length: match[0].length }
    }
  }
  if (!best) return null
  return { start: source.map[best.index], end: source.map[best.index + best.length - 1] + 1 }
}

const CLOSING_PUNCT = /["\u201D'\u2019\)]/

/** Check if position i is a sentence-ending punctuation that ends the sentence. */
function isSentenceBoundary(source: string, i: number): boolean {
  if (i >= source.length) return true
  const char = source[i]
  if (char === '\n') return true
  if (char === '.' || char === '!' || char === '?') {
    // Sentence-ending punctuation: check what follows
    let j = i + 1
    // Skip closing quotes/parens
    while (j < source.length && CLOSING_PUNCT.test(source[j])) {
      j++
    }
    // Must be followed by whitespace or end of text
    return j >= source.length || SPACE.test(source[j])
  }
  return false
}

/** Grows a span to the sentence (or line) that contains it, without the surrounding spaces. */
export function sentenceSpan(source: string, span: Span): Span {
  let start = span.start
  while (start > 0 && !isSentenceBoundary(source, start - 1)) start--
  // Skip any closing punctuation that belongs to the previous sentence
  while (start < source.length && CLOSING_PUNCT.test(source[start])) start++
  let end = span.end
  while (end < source.length && !isSentenceBoundary(source, end)) end++
  // Move past the sentence-ending punctuation and any following closing quotes
  if (end < source.length && (source[end] === '.' || source[end] === '!' || source[end] === '?')) {
    end++
    while (end < source.length && CLOSING_PUNCT.test(source[end])) {
      end++
    }
  } else if (end < source.length && source[end] === '\n') {
    end++
  }
  while (start < end && SPACE.test(source[start])) start++
  while (end > start && SPACE.test(source[end - 1])) end--
  return { start, end }
}
