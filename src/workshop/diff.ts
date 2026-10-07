export interface DiffPart {
  text: string
  added: boolean
}

const MAX_CELLS = 4_000_000
const isSpace = (token: string) => /^\s+$/.test(token)
const key = (token: string) => (isSpace(token) ? ' ' : token.toLowerCase())

/** Which parts of `after` are new compared with `before`, word by word (case ignored, spaces kept). */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean)
  const b = after.split(/(\s+)/).filter(Boolean)
  if (b.length === 0) return []
  if (a.length * b.length > MAX_CELLS) return [{ text: after, added: false }]
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
      // A space between two added words stays inside the highlight.
      push(b[j], isSpace(b[j]) ? (parts[parts.length - 1]?.added ?? false) : true)
      j++
    }
  }
  return parts
}
