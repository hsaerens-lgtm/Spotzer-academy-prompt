import { useCallback, useEffect, useRef, type RefObject } from 'react'

export interface FocusReturn {
  /** Ref for the button that starts the call. */
  button: RefObject<HTMLButtonElement | null>
  /** Call when the call starts: notes whether the button had the keyboard focus. */
  remember: () => void
}

/**
 * A pressed button that turns disabled while its call runs loses the keyboard focus: the browser moves it to the
 * page. When `busy` ends, the button (or what it became, such as "Try again") gets it back, unless the reader has
 * moved the focus somewhere else in the meantime.
 */
export function useFocusReturn(busy: boolean): FocusReturn {
  const button = useRef<HTMLButtonElement>(null)
  const hadFocus = useRef(false)
  const remember = useCallback(() => {
    const element = button.current
    hadFocus.current = element !== null && element.ownerDocument.activeElement === element
  }, [])

  useEffect(() => {
    if (busy || !hadFocus.current) return
    hadFocus.current = false
    const element = button.current
    if (!element || element.disabled) return
    const active = element.ownerDocument.activeElement
    if (active === null || active === element.ownerDocument.body || active === element) element.focus()
  }, [busy])

  return { button, remember }
}
