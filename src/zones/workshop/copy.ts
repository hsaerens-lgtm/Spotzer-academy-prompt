import { useCallback, useRef, useState } from 'react'

/** Copies to the clipboard; false when the browser refuses (the caller then shows the text selected). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export interface CopyWithFallback {
  /** Copies `text`; when the clipboard refuses, `fallback` holds it for the caller to show selected with the Ctrl+C hint. */
  copy: (text: string) => Promise<void>
  /** The last copy reached the clipboard. */
  copied: boolean
  /** The text to show selected after a refused copy (null otherwise). */
  fallback: string | null
  /** Ref for the fallback field: selects its text when it appears and again after each refused copy. */
  selectFallback: (element: HTMLTextAreaElement | null) => void
  /** Back to idle, when the copied text changes: a copy still on its way is dropped. */
  reset: () => void
}

interface CopyState {
  copied: boolean
  fallback: string | null
}

const IDLE: CopyState = { copied: false, fallback: null }

/** The copy button's state machine (idle, copied, or refused with the text to select), shared by every Copy button. */
export function useCopyWithFallback(): CopyWithFallback {
  const [state, setState] = useState<CopyState>(IDLE)
  const latest = useRef(0)
  const copy = useCallback(async (text: string) => {
    const run = ++latest.current
    const ok = await copyText(text)
    if (run === latest.current) setState(ok ? { copied: true, fallback: null } : { copied: false, fallback: text })
  }, [])
  const reset = useCallback(() => {
    latest.current++
    setState(IDLE)
  }, [])
  // Depends on `state` on purpose: a new callback for each outcome (and only then) makes React call it again,
  // so a second refused copy selects the text again, while other re-renders leave the reader's selection alone.
  const selectFallback = useCallback((element: HTMLTextAreaElement | null) => element?.select(), [state])
  return { copy, copied: state.copied, fallback: state.fallback, selectFallback, reset }
}
