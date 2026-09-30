import { useEffect, useRef, useState } from 'react'

export const CHARS_PER_SECOND = 45

export function revealedCount(elapsedMs: number, length: number, cps = CHARS_PER_SECOND): number {
  return Math.min(length, Math.floor((elapsedMs / 1000) * cps))
}

interface Options {
  active: boolean
  onDone: () => void
  onReveal?: (char: string, index: number) => void
}

/** Returns how many characters of `text` are visible. Inactive means the whole text. */
export function useTypewriter(text: string, { active, onDone, onReveal }: Options): number {
  const [count, setCount] = useState(active ? 0 : text.length)
  const callbacks = useRef({ onDone, onReveal })
  callbacks.current = { onDone, onReveal }

  useEffect(() => {
    if (!active) {
      setCount(text.length)
      return
    }
    setCount(0)
    const startedAt = Date.now()
    let shown = 0
    const id = window.setInterval(() => {
      const next = revealedCount(Date.now() - startedAt, text.length)
      for (let i = shown; i < next; i++) callbacks.current.onReveal?.(text[i], i)
      shown = next
      setCount(next)
      if (next >= text.length) {
        window.clearInterval(id)
        callbacks.current.onDone()
      }
    }, 1000 / 60)
    return () => window.clearInterval(id)
  }, [text, active])

  return count
}
