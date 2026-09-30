import type { StoreApi } from 'zustand/vanilla'
import { ZONES, type AppState, type ZoneId } from './store'

export interface Route {
  zone: ZoneId
  topic: string | null
}

const isZone = (value: string): value is ZoneId => (ZONES as readonly string[]).includes(value)

export function parseHash(hash: string): Route {
  const match = hash.replace(/^#/, '').match(/^\/([a-z]+)(?:\?(.*))?$/)
  const zone = match && isZone(match[1]) ? match[1] : 'office'
  let topic: string | null = null
  if (zone === 'office' && match?.[2]) {
    try {
      topic = new URLSearchParams(match[2]).get('topic') || null
    } catch {
      topic = null
    }
  }
  return { zone, topic }
}

export function formatHash(route: Route): string {
  const query = route.zone === 'office' && route.topic ? `?topic=${encodeURIComponent(route.topic)}` : ''
  return `#/${route.zone}${query}`
}

/** Keeps the URL hash and the store in sync. Returns a cleanup function. */
export function startRouter(store: StoreApi<AppState>, win: Window = window): () => void {
  const currentHash = () => {
    const s = store.getState()
    return formatHash({ zone: s.zone, topic: s.zone === 'office' ? s.activeTopic : null })
  }

  const initial = parseHash(win.location.hash)
  if (initial.zone !== 'office') store.setState({ zone: initial.zone })
  else if (initial.topic) store.getState().openTopic(initial.topic)
  win.history.replaceState(null, '', currentHash())

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.transition) return
    const hash = currentHash()
    if (hash === win.location.hash) return
    if (state.zone !== previous.zone) win.history.pushState(null, '', hash)
    else win.history.replaceState(null, '', hash)
  })

  const onNavigate = () => {
    const route = parseHash(win.location.hash)
    const s = store.getState()
    if (route.zone !== s.zone) s.requestZone(route.zone)
    else if (route.zone === 'office' && route.topic && route.topic !== s.activeTopic) s.openTopic(route.topic)
    // While a transition runs, the subscriber reconciles the URL when it ends.
    if (store.getState().transition) return
    // State wins: a stale or hand-edited hash is replaced by the canonical one.
    const hash = currentHash()
    if (hash !== win.location.hash) win.history.replaceState(null, '', hash)
  }
  win.addEventListener('popstate', onNavigate)
  win.addEventListener('hashchange', onNavigate)

  return () => {
    unsubscribe()
    win.removeEventListener('popstate', onNavigate)
    win.removeEventListener('hashchange', onNavigate)
  }
}
