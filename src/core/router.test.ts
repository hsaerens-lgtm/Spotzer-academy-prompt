import { makeTopic } from '../test/fixtures'
import { memoryStorage } from '../test/memoryStorage'
import { formatHash, parseHash, startRouter } from './router'
import { createAppStore } from './store'

describe('parseHash', () => {
  const route = (zone: string, extra: Partial<{ topic: string; mission: string; app: string }> = {}) => ({
    zone,
    topic: null,
    mission: null,
    app: null,
    ...extra,
  })
  it.each([
    ['', route('office')],
    ['#/office', route('office')],
    ['#/workshop', route('workshop')],
    ['#/dungeon', route('dungeon')],
    ['#/office?topic=tokens', route('office', { topic: 'tokens' })],
    ['#/office?topic=', route('office')],
    ['#/dungeon?topic=tokens', route('dungeon')],
    ['#/nope', route('office')],
    ['#garbage??', route('office')],
    ['#/workshop?mission=florist-post', route('workshop', { mission: 'florist-post' })],
    ['#/workshop?app=corrector', route('workshop', { app: 'corrector' })],
    ['#/workshop?app=prompts&mission=newsletter', route('workshop', { app: 'prompts', mission: 'newsletter' })],
    ['#/workshop?app=hack', route('workshop')],
    ['#/office?mission=florist-post', route('office')],
  ])('%s', (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected)
  })
})

test('formatHash', () => {
  const route = { topic: null, mission: null, app: null }
  expect(formatHash({ ...route, zone: 'office' })).toBe('#/office')
  expect(formatHash({ ...route, zone: 'office', topic: 'tokens' })).toBe('#/office?topic=tokens')
  expect(formatHash({ ...route, zone: 'workshop', topic: 'tokens' })).toBe('#/workshop')
  expect(formatHash({ ...route, zone: 'workshop', mission: 'florist-post' })).toBe('#/workshop?mission=florist-post')
  expect(formatHash({ ...route, zone: 'workshop', mission: 'florist-post', app: 'corrector' })).toBe('#/workshop?app=corrector')
})

describe('startRouter', () => {
  const alpha = makeTopic({ id: 'alpha' })
  const newStore = () =>
    createAppStore({ getTopic: (_lang, id) => (id === 'alpha' ? alpha : undefined), storage: memoryStorage() })
  let stop: () => void = () => {}

  afterEach(() => {
    stop()
    stop = () => {}
    window.history.replaceState(null, '', '#')
  })

  it('opens the zone from the initial hash', () => {
    window.history.replaceState(null, '', '#/dungeon')
    const store = newStore()
    stop = startRouter(store)
    expect(store.getState().zone).toBe('dungeon')
    expect(window.location.hash).toBe('#/dungeon')
  })

  it('opens a deep-linked topic', () => {
    window.history.replaceState(null, '', '#/office?topic=alpha')
    const store = newStore()
    stop = startRouter(store)
    expect(store.getState().activeTopic).toBe('alpha')
    expect(window.location.hash).toBe('#/office?topic=alpha')
  })

  // Review focus 4: hand-edited or stale URLs.
  it('lands on the office overview for unknown topics or zones', () => {
    for (const hash of ['#/office?topic=ghost', '#/nowhere', '#%%%']) {
      window.history.replaceState(null, '', hash)
      const store = newStore()
      stop()
      stop = startRouter(store)
      expect(store.getState()).toMatchObject({ zone: 'office', activeTopic: null, railTarget: 0 })
      expect(window.location.hash).toBe('#/office')
    }
  })

  it('pushes a history entry once the zone has changed', () => {
    window.history.replaceState(null, '', '#/office')
    const store = newStore()
    stop = startRouter(store)
    const before = window.history.length
    store.getState().requestZone('workshop', 'laptop')
    expect(window.location.hash).toBe('#/office')
    store.getState().transitionStep()
    store.getState().transitionStep()
    expect(window.location.hash).toBe('#/workshop')
    expect(window.history.length).toBe(before + 1)
  })

  it('keeps the topic in the URL without adding history entries', () => {
    window.history.replaceState(null, '', '#/office')
    const store = newStore()
    stop = startRouter(store)
    const before = window.history.length
    store.getState().openTopic('alpha')
    expect(window.location.hash).toBe('#/office?topic=alpha')
    expect(window.history.length).toBe(before)
  })

  it('follows the back button, even when pressed twice during a transition', () => {
    window.history.replaceState(null, '', '#/workshop')
    const store = newStore()
    stop = startRouter(store)
    window.history.replaceState(null, '', '#/office')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(store.getState().transition).toEqual({ to: 'office', via: null, stage: 'fade' })
    window.dispatchEvent(new PopStateEvent('popstate'))
    store.getState().transitionStep()
    expect(store.getState().zone).toBe('office')
    expect(store.getState().transition).toBeNull()
    expect(window.location.hash).toBe('#/office')
  })

  // Review focus 4 at runtime: the fragment is edited while the app is open.
  describe('hand-edited hash while the app is open', () => {
    const edit = (hash: string) => {
      window.history.replaceState(null, '', hash)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
    const openAlpha = () => {
      window.history.replaceState(null, '', '#/office?topic=alpha')
      const store = newStore()
      stop = startRouter(store)
      expect(store.getState().activeTopic).toBe('alpha')
      return store
    }

    it('restores the URL when an unknown topic is typed', () => {
      const store = openAlpha()
      edit('#/office?topic=ghost')
      expect(store.getState().activeTopic).toBe('alpha')
      expect(window.location.hash).toBe('#/office?topic=alpha')
    })

    it('restores the URL when an unknown zone is typed', () => {
      const store = openAlpha()
      edit('#/nope')
      expect(store.getState().zone).toBe('office')
      expect(store.getState().transition).toBeNull()
      expect(window.location.hash).toBe('#/office?topic=alpha')
    })

    it('keeps an open topic when the topic is removed from the URL', () => {
      const store = openAlpha()
      edit('#/office')
      expect(store.getState().activeTopic).toBe('alpha')
      expect(window.location.hash).toBe('#/office?topic=alpha')
    })

    it('normalises without adding history entries', () => {
      const store = openAlpha()
      const before = window.history.length
      edit('#/office?topic=ghost')
      edit('#/nope')
      edit('#%%%')
      expect(store.getState().activeTopic).toBe('alpha')
      expect(window.location.hash).toBe('#/office?topic=alpha')
      expect(window.history.length).toBe(before)
    })

    it('leaves the URL alone while a transition runs and reconciles when it ends', () => {
      window.history.replaceState(null, '', '#/office')
      const store = newStore()
      stop = startRouter(store)
      store.getState().requestZone('workshop', 'laptop')
      edit('#/dungeon')
      expect(window.location.hash).toBe('#/dungeon')
      expect(store.getState().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
      store.getState().transitionStep()
      store.getState().transitionStep()
      expect(store.getState().zone).toBe('workshop')
      expect(window.location.hash).toBe('#/workshop')
    })
  })

  describe('workshop', () => {
    it('opens a deep-linked mission', () => {
      window.history.replaceState(null, '', '#/workshop?mission=florist-post')
      const store = newStore()
      stop = startRouter(store)
      expect(store.getState()).toMatchObject({ zone: 'workshop', workshopRoute: { mission: 'florist-post', app: null } })
      expect(window.location.hash).toBe('#/workshop?mission=florist-post')
    })

    // Like ?topic= in the office: moving inside a zone never adds a history entry, so Back leaves the zone.
    it('fills in the mission, then changes mission or program, without history entries', () => {
      window.history.replaceState(null, '', '#/workshop')
      const store = newStore()
      stop = startRouter(store)
      const before = window.history.length
      store.getState().setWorkshopRoute({ mission: 'delayed-website', app: null })
      expect(window.location.hash).toBe('#/workshop?mission=delayed-website')
      expect(window.history.length).toBe(before)
      store.getState().setWorkshopRoute({ mission: 'newsletter', app: null })
      expect(window.location.hash).toBe('#/workshop?mission=newsletter')
      store.getState().setWorkshopRoute({ mission: 'newsletter', app: 'corrector' })
      expect(window.location.hash).toBe('#/workshop?app=corrector')
      expect(window.history.length).toBe(before)
    })

    it('normalises an unknown mission without a history entry, and Back is not trapped', async () => {
      window.history.replaceState(null, '', '#/office')
      window.history.pushState(null, '', '#/workshop?mission=ghost')
      const store = newStore()
      stop = startRouter(store)
      expect(store.getState().workshopRoute).toEqual({ mission: 'ghost', app: null })
      const before = window.history.length
      // The workshop swaps an unknown mission for the suggested one.
      store.getState().setWorkshopRoute({ mission: 'florist-post', app: null })
      expect(window.location.hash).toBe('#/workshop?mission=florist-post')
      expect(window.history.length).toBe(before)
      window.history.back()
      await new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
      expect(store.getState().transition).toEqual({ to: 'office', via: null, stage: 'fade' })
      expect(window.location.hash).toBe('#/office')
      expect(window.history.length).toBe(before)
    })

    // Review focus 4: Back and Forward between missions.
    it('follows Back to the previous mission', () => {
      window.history.replaceState(null, '', '#/workshop?mission=newsletter')
      const store = newStore()
      stop = startRouter(store)
      window.history.replaceState(null, '', '#/workshop?mission=delayed-website')
      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(store.getState().workshopRoute).toEqual({ mission: 'delayed-website', app: null })
    })

    it('keeps the last mission when leaving for the office and coming back', () => {
      window.history.replaceState(null, '', '#/workshop?mission=newsletter')
      const store = newStore()
      stop = startRouter(store)
      store.getState().requestZone('office')
      store.getState().transitionStep()
      expect(window.location.hash).toBe('#/office')
      store.getState().requestZone('workshop')
      store.getState().transitionStep()
      expect(window.location.hash).toBe('#/workshop?mission=newsletter')
    })

    it('landing on a workshop entry from the office does not rewrite the office entry', () => {
      window.history.replaceState(null, '', '#/office')
      const store = newStore()
      stop = startRouter(store)
      const before = window.history.length
      // Forward (or Back) to a workshop entry: the browser has already moved the URL.
      window.history.replaceState(null, '', '#/workshop?mission=newsletter')
      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(store.getState().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
      expect(window.location.hash).toBe('#/workshop?mission=newsletter')
      store.getState().transitionStep()
      expect(store.getState()).toMatchObject({ zone: 'workshop', workshopRoute: { mission: 'newsletter', app: null } })
      expect(window.location.hash).toBe('#/workshop?mission=newsletter')
      expect(window.history.length).toBe(before)
    })
  })
})
