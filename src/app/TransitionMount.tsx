import { startTransition, useEffect, useState, type ReactNode } from 'react'

/**
 * Mounts its children in a transition, after a first commit without them. Inside a Suspense boundary, that boundary
 * is then already revealed (with nothing): if the children suspend, React keeps showing nothing and commits them as
 * soon as their data is in, instead of committing the fallback. A committed fallback makes React hold the boundary's
 * reveal back until 300 ms after it (its fallback throttle): on the reference PC that delayed the office by up to
 * 0.3 s whenever a base model was still parsing at the first render (Task 16b).
 */
export function TransitionMount({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => startTransition(() => setMounted(true)), [])
  return mounted ? children : null
}
