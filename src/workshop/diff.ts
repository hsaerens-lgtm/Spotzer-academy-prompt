export interface DiffPart {
  text: string
  added: boolean
}

/** Above this many table cells the diff shows the text plain. It also caps every table value at 2000 (the shorter side), so Uint16 fits. */
const MAX_CELLS = 4_000_000
const isSpace = (token: string) => /^\s+$/.test(token)
const key = (token: string) => (isSpace(token) ? ' ' : token.toLowerCase())

/** Which parts of `after` are new compared with `before`, word by word (case ignored, spaces kept). */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean)
  const b = after.split(/(\s+)/).filter(Boolean)
  if (b.length === 0) return []
  if (a.length * b.length > MAX_CELLS) return [{ text: after, added: false }]
  // Each token becomes a number once, so the table compares numbers, not strings.
  const ids = new Map<string, number>()
  const idsOf = (tokens: string[]) =>
    Int32Array.from(tokens, (token) => {
      const k = key(token)
      let id = ids.get(k)
      if (id === undefined) ids.set(k, (id = ids.size))
      return id
    })
  const ka = idsOf(a)
  const kb = idsOf(b)
  // lcs[i * width + j]: the longest common run of a[i..] and b[j..] (one flat table, no row arrays).
  const width = b.length + 1
  const lcs = new Uint16Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    const row = i * width
    for (let j = b.length - 1; j >= 0; j--) {
      const cell = row + j
      lcs[cell] = ka[i] === kb[j] ? lcs[cell + width + 1] + 1 : Math.max(lcs[cell + width], lcs[cell + 1])
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
    if (i < a.length && ka[i] === kb[j]) {
      push(b[j], false)
      i++
      j++
    } else if (i < a.length && lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      i++
    } else {
      // A space between two added words stays inside the highlight.
      push(b[j], isSpace(b[j]) ? (parts[parts.length - 1]?.added ?? false) : true)
      j++
    }
  }
  return parts
}
