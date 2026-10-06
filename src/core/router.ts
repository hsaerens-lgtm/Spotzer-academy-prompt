import type { StoreApi } from 'zustand/vanilla'
import { ZONES, type AppState, type WorkshopApp, type ZoneId } from './store'

export interface Route {
  zone: ZoneId
  topic: string | null
  mission: string | null
  app: WorkshopApp | null
}

const APPS: readonly WorkshopApp[] = ['corrector', 'prompts']
const isZone = (value: string): value is ZoneId => (ZONES as readonly string[]).includes(value)
const isApp = (value: string | null): value is WorkshopApp => value !== null && (APPS as readonly string[]).includes(value)

export function parseHash(hash: string): Route {
  const match = hash.replace(/^#/, '').match(/^\/([a-z]+)(?:\?(.*))?$/)
  const zone = match && isZone(match[1]) ? match[1] : 'office'
  let params: URLSearchParams | null = null
  if (match?.[2]) {
    try {
      params = new URLSearchParams(match[2])
    } catch {
      params = null
    }
  }
  const app = zone === 'workshop' ? params?.get('app') ?? null : null
  return {
    zone,
    topic: zone === 'office' ? params?.get('topic') || null : null,
    mission: zone === 'workshop' ? params?.get('mission') || null : null,
    app: isApp(app) ? app : null,
  }
}

export function formatHash(route: Route): string {
  let query = ''
  if (route.zone === 'office' && route.topic) query = `?topic=${encodeURIComponent(route.topic)}`
  else if (route.zone === 'workshop' && route.app) query = `?app=${route.app}`
  else if (route.zone === 'workshop' && route.mission) query = `?mission=${encodeURIComponent(route.mission)}`
  return `#/${route.zone}${query}`
}

/** Keeps the URL hash and the store in sync. Returns a cleanup function. */
export function startRouter(store: StoreApi<AppState>, win: Window = window): () => void {
  const currentHash = () => {
    const s = store.getState()
    const workshop = s.zone === 'workshop'
    return formatHash({
      zone: s.zone,
      topic: s.zone === 'office' ? s.activeTopic : null,
      mission: workshop ? s.workshopRoute.mission : null,
      app: workshop ? s.workshopRoute.app : null,
    })
  }

  const initial = parseHash(win.location.hash)
  if (initial.zone === 'workshop') store.getState().setWorkshopRoute({ mission: initial.mission, app: initial.app })
  if (initial.zone !== 'office') store.setState({ zone: initial.zone })
  else if (initial.topic) store.getState().openTopic(initial.topic)
  win.history.replaceState(null, '', currentHash())

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.transition) return
    const hash = currentHash()
    if (hash === win.location.hash) return
    // Only entering or leaving a zone is a step the Back button undoes. Changing the mission or the program inside
    // the workshop, like opening a topic in the office, or filling in a missing mission, replaces the entry.
    if (state.zone !== previous.zone) win.history.pushState(null, '', hash)
    else win.history.replaceState(null, '', hash)
  })

  const onNavigate = () => {
    const route = parseHash(win.location.hash)
    const s = store.getState()
    if (route.zone !== s.zone) s.requestZone(route.zone)
    else if (route.zone === 'office' && route.topic && route.topic !== s.activeTopic) s.openTopic(route.topic)
    // After requestZone: the transition it starts keeps the subscriber from rewriting the entry the browser just
    // landed on (the workshop route is still applied while the office is on screen).
    if (route.zone === 'workshop') s.setWorkshopRoute({ mission: route.mission, app: route.app })
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
