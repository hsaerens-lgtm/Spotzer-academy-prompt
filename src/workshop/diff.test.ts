import { MAX_CORRECT_PROMPT, MAX_RUN_PROMPT } from './model'
import { diffWords, type DiffPart } from './diff'

test('marks the words added by the improved prompt', () => {
  expect(diffWords('Write a post', 'Write a short post')).toEqual([
    { text: 'Write a ', added: false },
    { text: 'short ', added: true },
    { text: 'post', added: false },
  ])
})

test('ignores case when matching, keeps the new text', () => {
  expect(diffWords('write a post', 'Write a post.')).toEqual([
    { text: 'Write a ', added: false },
    { text: 'post.', added: true },
  ])
})

test('everything is new when the original is empty', () => {
  expect(diffWords('', 'You are a writer.')).toEqual([{ text: 'You are a writer.', added: true }])
})

/** The first version of diffWords (string keys, one array per row), kept as the reference for the faster one. */
function referenceDiff(before: string, after: string): DiffPart[] {
  const isSpace = (token: string) => /^\s+$/.test(token)
  const key = (token: string) => (isSpace(token) ? ' ' : token.toLowerCase())
  const a = before.split(/(\s+)/).filter(Boolean)
  const b = after.split(/(\s+)/).filter(Boolean)
  if (b.length === 0) return []
  if (a.length * b.length > 4_000_000) return [{ text: after, added: false }]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = key(a[i]) === key(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const parts: DiffPart[] = []
  const push = (text: string, added: boolean) => {
    const last = parts[parts.length - 1]
    if (last && last.added === added) last.text += text
    else parts.push({ text, added })
  }
  let i = 0
  let j = 0
  while (j < b.length) {
    if (i < a.length && key(a[i]) === key(b[j])) {
      push(b[j], false)
      i++
      j++
    } else if (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++
    } else {
      push(b[j], isSpace(b[j]) ? (parts[parts.length - 1]?.added ?? false) : true)
      j++
    }
  }
  return parts
}

/** A small seeded generator (mulberry32), so the long texts are the same on every run. */
function random(seed: number) {
  let state = seed
  return (n: number) => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) % n
  }
}

const WORDS = ['You', 'are', 'a', 'writer', 'Write', 'post', 'short', 'warm', 'for', "Rosa's", 'Flowers', '15%', 'off', 'bouquets', 'Sunday.', 'tone:', 'friendly']
const SPACES = [' ', ' ', ' ', '  ', '\n', '\n\n', '\t']

function words(next: (n: number) => number, length: number): string {
  let text = ''
  while (text.length < length) text += WORDS[next(WORDS.length)] + SPACES[next(SPACES.length)]
  return text.slice(0, length)
}

/** An "improved" version: words kept (in another case, sometimes), dropped, or with new ones in between. */
function edit(next: (n: number) => number, text: string, length: number): string {
  let out = ''
  for (const token of text.split(/(\s+)/)) {
    if (out.length >= length) break
    const roll = next(10)
    if (roll === 0) continue
    if (roll === 1) out += token.toUpperCase()
    else if (roll < 4) out += `${WORDS[next(WORDS.length)]} ${token}`
    else out += token
  }
  return (out + words(next, length)).slice(0, length)
}

test('gives the same parts as the first version on long prompts', () => {
  for (const seed of [1, 7, 42]) {
    const next = random(seed)
    const before = words(next, MAX_CORRECT_PROMPT)
    const after = edit(next, before, MAX_RUN_PROMPT)
    const parts = diffWords(before, after)
    expect(parts).toEqual(referenceDiff(before, after))
    expect(parts.map((part) => part.text).join('')).toBe(after)
    // Both kinds of parts: the table ran (above its size limit the diff would show the text plain).
    expect(parts.some((part) => part.added) && parts.some((part) => !part.added)).toBe(true)
  }
})

test('gives the same parts as the first version on many short prompts', () => {
  const next = random(2026)
  for (let round = 0; round < 200; round++) {
    const before = words(next, next(120))
    const after = edit(next, before, next(160))
    expect(diffWords(before, after)).toEqual(referenceDiff(before, after))
  }
})
