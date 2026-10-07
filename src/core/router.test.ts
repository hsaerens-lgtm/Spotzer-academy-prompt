import { makeTopic } from '../test/fixtures'
import { memoryStorage } from '../test/memoryStorage'
import { formatHash, parseHash, startRouter } from './router'
import { createAppStore } from './store'

describe('parseHash', () => {
  it.each([
    ['', { zone: 'office', topic: null }],
    ['#/office', { zone: 'office', topic: null }],
    ['#/workshop', { zone: 'workshop', topic: null }],
    ['#/dungeon', { zone: 'dungeon', topic: null }],
    ['#/office?topic=tokens', { zone: 'office', topic: 'tokens' }],
    ['#/office?topic=', { zone: 'office', topic: null }],
    ['#/dungeon?topic=tokens', { zone: 'dungeon', topic: null }],
    ['#/nope', { zone: 'office', topic: null }],
    ['#garbage??', { zone: 'office', topic: null }],
  ])('%s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route)
  })
})

test('formatHash', () => {
  expect(formatHash({ zone: 'office', topic: null })).toBe('#/office')
  expect(formatHash({ zone: 'office', topic: 'tokens' })).toBe('#/office?topic=tokens')
  expect(formatHash({ zone: 'workshop', topic: 'tokens' })).toBe('#/workshop')
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

  // Review focus 4: `?phase=` is read once at start-up and must survive every hash change.
  it('the router keeps ?phase in the address', () => {
    window.history.replaceState(null, '', '/?phase=night#/office')
    try {
      const store = newStore()
      stop = startRouter(store)
      expect(window.location.search).toBe('?phase=night')
      store.getState().requestZone('workshop', 'laptop')
      store.getState().transitionStep()
      store.getState().transitionStep()
      expect(window.location.hash).toBe('#/workshop')
      window.history.replaceState(null, '', '#/office')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      store.getState().transitionStep()
      expect(store.getState().zone).toBe('office')
      expect(window.location.hash).toBe('#/office')
      expect(window.location.search).toBe('?phase=night')
    } finally {
      window.history.replaceState(null, '', '/')
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
})
