import { Component, type ReactNode } from 'react'

interface Props {
  /** Shown in the development warning. */
  name: string
  children: ReactNode
  /** Drawn instead when the item fails (a base object's procedural stand-in); nothing by default. */
  fallback?: ReactNode
}

/**
 * Errors an AssetBoundary has handled. R3F's root reports every error a boundary catches with reportError(), which
 * fires a window "error" event and shows it as uncaught (a page error for Playwright, an exception in the console);
 * the listener below cancels exactly these events, so a missing decor model ends as one warning, nothing more.
 */
const handled = new WeakSet<object>()
let mounted = 0

function cancelHandledError(event: ErrorEvent) {
  const { error } = event
  if (typeof error === 'object' && error !== null && handled.has(error)) event.preventDefault()
}

/**
 * Error boundary of one decor item (spec section 8): when its model cannot load (404, network cut, corrupt file), the
 * item is left out and the rest of the office carries on. Development builds say so once in the console.
 * There is no retry: a failed item stays out until the office mounts again, so a model never remounts in a loop.
 */
export class AssetBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(error: unknown) {
    if (typeof error === 'object' && error !== null) handled.add(error)
    return { failed: true }
  }

  componentDidMount() {
    if (mounted++ === 0) window.addEventListener('error', cancelHandledError)
  }

  componentWillUnmount() {
    if (--mounted === 0) window.removeEventListener('error', cancelHandledError)
  }

  componentDidCatch(error: unknown) {
    if (!import.meta.env.DEV) return
    if (this.props.fallback === undefined) console.warn(`Decor item "${this.props.name}" failed to load and is left out.`, error)
    else console.warn(`Model "${this.props.name}" failed to load: its stand-in is drawn instead.`, error)
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
