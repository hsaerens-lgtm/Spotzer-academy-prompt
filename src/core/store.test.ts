import type { StoreApi } from 'zustand/vanilla'
import { makeTopic } from '../test/fixtures'
import { memoryStorage } from '../test/memoryStorage'
import type { Phase } from './phase'
import { PROGRESS_KEY, SETTINGS_KEY } from './progress'
import { createAppStore, type AppState } from './store'

const alpha = makeTopic({ id: 'alpha', next: 'beta' })
const beta = makeTopic({ id: 'beta' })
const topics: Record<string, typeof alpha> = { alpha, beta }

function setup(options: { reducedMotion?: boolean; initialPhase?: Phase; now?: () => number } = {}) {
  const storage = memoryStorage()
  const store = createAppStore({
    getTopic: (_lang, id) => topics[id],
    storage,
    reducedMotion: options.reducedMotion,
    initialPhase: options.initialPhase,
    now: options.now,
  })
  return { store, storage, s: () => store.getState() }
}

function toChoices(store: StoreApi<AppState>) {
  for (let i = 0; i < 40 && store.getState().dialogue?.phase !== 'choices'; i++) store.getState().advanceDialogue()
}

describe('zones and transitions', () => {
  it('flies, then fades, then switches zone', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    expect(s().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
    s().transitionStep()
    expect(s().transition?.stage).toBe('fade')
    s().transitionStep()
    expect(s().zone).toBe('workshop')
    expect(s().transition).toBeNull()
  })

  it('fades directly without an object, with reduced motion or in reading mode', () => {
    const plain = setup()
    plain.s().requestZone('dungeon')
    expect(plain.s().transition).toEqual({ to: 'dungeon', via: null, stage: 'fade' })

    const reduced = setup({ reducedMotion: true })
    reduced.s().requestZone('dungeon', 'tv')
    expect(reduced.s().transition).toEqual({ to: 'dungeon', via: null, stage: 'fade' })

    const reading = setup()
    reading.s().setReadingMode(true)
    reading.s().requestZone('workshop', 'laptop')
    expect(reading.s().transition?.stage).toBe('fade')
  })

  // Review focus 2: double clicks or a second object during a flight.
  it('ignores new requests while a transition runs', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    s().requestZone('dungeon', 'tv')
    s().requestZone('workshop', 'laptop')
    expect(s().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
    s().transitionStep()
    s().transitionStep()
    s().transitionStep()
    expect(s().zone).toBe('workshop')
    expect(s().transition).toBeNull()
  })

  // A flight is driven by the 3D camera; if 3D goes away mid-flight the fade must still finish.
  it('downgrades a running flight to a fade when reading mode is turned on', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    s().setReadingMode(true)
    expect(s().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
    s().transitionStep()
    expect(s().zone).toBe('workshop')
    expect(s().transition).toBeNull()
  })

  it('downgrades a running flight to a fade when WebGL becomes unavailable', () => {
    const { s } = setup()
    s().requestZone('dungeon', 'tv')
    s().setWebgl('unavailable')
    expect(s().transition).toEqual({ to: 'dungeon', via: null, stage: 'fade' })
    s().transitionStep()
    expect(s().zone).toBe('dungeon')
    expect(s().transition).toBeNull()
  })

  it('leaves a fade untouched, ignores requests during it, and is not stuck afterwards', () => {
    const { s } = setup()
    s().requestZone('workshop')
    s().setReadingMode(true)
    s().setWebgl('unavailable')
    expect(s().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
    s().requestZone('dungeon', 'tv')
    expect(s().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
    s().transitionStep()
    expect(s()).toMatchObject({ zone: 'workshop', transition: null })
    s().requestZone('office')
    expect(s().transition).toEqual({ to: 'office', via: null, stage: 'fade' })
    s().transitionStep()
    expect(s()).toMatchObject({ zone: 'office', transition: null })
  })

  it('turning reading mode off or restoring WebGL does not touch a running flight', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    s().setReadingMode(false)
    s().setWebgl('ok')
    expect(s().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
  })

  it('ignores a request for the current zone', () => {
    const { s } = setup()
    s().requestZone('office', 'laptop')
    expect(s().transition).toBeNull()
  })

  it('arriving at the office resets the view', () => {
    const { s } = setup()
    s().openTopic('alpha')
    s().requestZone('workshop')
    s().transitionStep()
    s().requestZone('office')
    s().transitionStep()
    expect(s()).toMatchObject({ zone: 'office', railTarget: 0, activeTopic: null, dialogue: null, menuOpen: false })
  })
})

describe('rail', () => {
  it('clamps the target and remembers the first scroll', () => {
    const { s } = setup()
    expect(s().hasScrolled).toBe(false)
    s().nudgeRail(0.4)
    expect(s().railTarget).toBeCloseTo(0.4)
    expect(s().hasScrolled).toBe(true)
    s().nudgeRail(5)
    expect(s().railTarget).toBe(1)
    s().setRailTarget(-3)
    expect(s().railTarget).toBe(0)
  })

  it('scrolling against an end stop does not count as a scroll, so the hint stays', () => {
    const { s } = setup()
    s().nudgeRail(-0.5)
    expect(s()).toMatchObject({ railTarget: 0, hasScrolled: false })
    s().nudgeRail(0.5)
    expect(s()).toMatchObject({ railTarget: 0.5, hasScrolled: true })
    const atTop = setup()
    atTop.s().setRailTarget(1)
    atTop.s().nudgeRail(0.5)
    expect(atTop.s()).toMatchObject({ railTarget: 1, hasScrolled: false })
  })

  it('opening the menu moves to the presentation view', () => {
    const { s } = setup()
    s().openMenu()
    expect(s()).toMatchObject({ menuOpen: true, railTarget: 1 })
    s().closeMenu()
    expect(s().menuOpen).toBe(false)
  })
})

describe('topics and dialogue', () => {
  it('ignores unknown topics', () => {
    const { s } = setup()
    s().openTopic('ghost')
    expect(s().activeTopic).toBeNull()
  })

  it('opens a topic, records the first visit and persists it', () => {
    const { s, storage } = setup()
    s().openMenu()
    s().openTopic('alpha')
    expect(s()).toMatchObject({ activeTopic: 'alpha', menuOpen: false, railTarget: 1 })
    expect(s().dialogue).toEqual({ topicId: 'alpha', section: 'basics', beatIndex: 0, phase: 'typing' })
    expect(JSON.parse(storage.data.get(PROGRESS_KEY)!).firstVisitDone).toBe(true)
  })

  it('marks basics then deeper as seen', () => {
    const { store, s, storage } = setup()
    s().openTopic('alpha')
    toChoices(store)
    expect(s().progress.topicsSeen).toEqual(['alpha'])
    expect(JSON.parse(storage.data.get(PROGRESS_KEY)!).topicsSeen).toEqual(['alpha'])
    s().choose({ kind: 'deeper' })
    expect(s().dialogue?.section).toBe('deeper')
    toChoices(store)
    expect(s().progress.deeperSeen).toEqual(['alpha'])
  })

  it('next opens the next topic, all goes back to the menu', () => {
    const { store, s } = setup()
    s().openTopic('alpha')
    toChoices(store)
    s().choose({ kind: 'next', topicId: 'beta' })
    expect(s().activeTopic).toBe('beta')
    toChoices(store)
    s().choose({ kind: 'all' })
    expect(s()).toMatchObject({ activeTopic: null, dialogue: null, menuOpen: true })
  })

  it('finishTyping moves to the waiting phase', () => {
    const { s } = setup()
    s().openTopic('alpha')
    s().finishTyping()
    expect(s().dialogue?.phase).toBe('waiting')
  })
})

describe('settings and 3D status', () => {
  it('persists sound and language', () => {
    const { s, storage } = setup()
    s().setSound(false)
    s().setLang('en')
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ sound: false, lang: 'en' })
  })

  it('a lost WebGL context switches to reading mode and turns a flight into a fade', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    s().reportWebglLost()
    expect(s()).toMatchObject({ webgl: 'unavailable', webglLost: true, readingMode: true })
    expect(s().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
    s().transitionStep()
    expect(s()).toMatchObject({ zone: 'workshop', transition: null })
  })

  it('a lost WebGL context during a fade lets the fade finish in the target zone', () => {
    const { s } = setup()
    s().requestZone('workshop')
    expect(s().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
    s().reportWebglLost()
    expect(s().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
    s().transitionStep()
    expect(s()).toMatchObject({ zone: 'workshop', transition: null, readingMode: true })
  })

  it('a lost WebGL context with no transition leaves none', () => {
    const { s } = setup()
    s().reportWebglLost()
    expect(s().transition).toBeNull()
  })

  it('counts pokes on Ada and tracks hover and the expand overlay', () => {
    const { s } = setup()
    s().pokeAda()
    s().pokeAda()
    s().setHovered('laptop')
    s().setExpandOpen(true)
    expect(s()).toMatchObject({ adaPokes: 2, hovered: 'laptop', expandOpen: true })
  })
})

describe('time of day', () => {
  /** A store whose transition clock is `time`, moved by hand. */
  function timed(options: { reducedMotion?: boolean; initialPhase?: Phase } = {}) {
    const clock = { time: 1000 }
    return { ...setup({ ...options, now: () => clock.time }), clock }
  }

  it('the initial phase comes from the store deps', () => {
    expect(setup({ initialPhase: 'sunset' }).s()).toMatchObject({ phase: 'sunset', phaseTransition: null, decorReady: false })
    expect(setup().s().phase).toBe('day')
  })

  it('advancePhase starts a 2.5 s transition toward the next phase', () => {
    const { s } = timed()
    s().advancePhase()
    expect(s().phase).toBe('sunset')
    expect(s().phaseTransition).toEqual({ from: 'day', to: 'sunset', startedAt: 1000 })
  })

  // Review focus 1: repeated clicks on the clock or the Time of day button.
  it('advancePhase is ignored while a transition runs', () => {
    const { s, clock } = timed()
    s().advancePhase()
    clock.time = 1200
    s().advancePhase()
    clock.time = 3499
    s().advancePhase()
    expect(s().phase).toBe('sunset')
    expect(s().phaseTransition).toEqual({ from: 'day', to: 'sunset', startedAt: 1000 })
  })

  // Review focus 2: the 3D stopped (reading mode, lost context, another zone) before it could finish the transition.
  it('a stale transition never blocks the next one', () => {
    const { s, clock } = timed()
    s().advancePhase()
    clock.time = 3500
    s().advancePhase()
    expect(s().phase).toBe('night')
    expect(s().phaseTransition).toEqual({ from: 'sunset', to: 'night', startedAt: 3500 })
  })

  // Review focus 2: nothing can animate the change, so it happens at once and never stays "in transition".
  it('advancePhase is instant whenever no 3D can animate it', () => {
    const cases: [string, ReturnType<typeof timed>][] = [
      ['reduced motion', timed({ reducedMotion: true })],
      ['reading mode', timed()],
      ['no WebGL', timed()],
      ['another zone', timed()],
      ['a flight', timed()],
    ]
    cases[1][1].s().setReadingMode(true)
    cases[2][1].s().setWebgl('unavailable')
    cases[3][1].store.setState({ zone: 'workshop' })
    cases[4][1].s().requestZone('workshop', 'laptop')
    for (const [name, { s }] of cases) {
      s().advancePhase()
      expect(s().phase, name).toBe('sunset')
      expect(s().phaseTransition, name).toBeNull()
      s().advancePhase()
      expect(s().phase, name).toBe('night')
    }
  })

  it('finishPhaseTransition and setPhase clear the transition', () => {
    const { store, s } = timed()
    s().advancePhase()
    s().finishPhaseTransition()
    expect(s()).toMatchObject({ phase: 'sunset', phaseTransition: null })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    s().finishPhaseTransition()
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
    s().advancePhase()
    s().setPhase('day')
    expect(s()).toMatchObject({ phase: 'day', phaseTransition: null })
  })

  it('decorReady is set by setDecorReady', () => {
    const { s } = setup()
    s().setDecorReady(true)
    expect(s().decorReady).toBe(true)
    s().setDecorReady(false)
    expect(s().decorReady).toBe(false)
  })
})

describe('workshop', () => {
  it('keeps the workshop route and ignores an identical one', () => {
    const { s, store } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    s().setWorkshopRoute({ mission: 'a', app: null })
    s().setWorkshopRoute({ mission: 'a', app: null })
    expect(s().workshopRoute).toEqual({ mission: 'a', app: null })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('saves a passed mission once and flags the workshop done', () => {
    const { s, storage } = setup()
    const setItem = vi.spyOn(storage, 'setItem')
    s().passWorkshopMission('a', 'Prompt A', ['a'])
    s().passWorkshopMission('a', 'Prompt A', ['a'])
    expect(setItem.mock.calls.filter(([key]) => key === PROGRESS_KEY)).toHaveLength(1)
    expect(s().progress).toMatchObject({ workshopDone: true, workshop: { passed: ['a'] } })
  })

  it('clears saved prompts', () => {
    const { s } = setup()
    s().passWorkshopMission('a', 'Prompt A', ['a', 'b'])
    s().clearWorkshopPrompts()
    expect(s().progress.workshop).toEqual({ passed: ['a'], prompts: {} })
  })

  // Review focus 5: storage unavailable.
  it('records passes in memory when storage is unavailable', () => {
    const store = createAppStore({ getTopic: () => undefined, storage: null })
    store.getState().passWorkshopMission('a', 'Prompt A', ['a', 'b'])
    expect(store.getState().progress.workshop?.passed).toEqual(['a'])
  })
})

describe('dungeon state', () => {
  it('passes a floor into the saved progress and keeps the route apart', () => {
    const { s } = setup()
    s().setDungeonRoute({ floor: 1 })
    expect(s().dungeonRoute).toEqual({ floor: 1 })
    s().passDungeonFloor(1, 85, '2026-10-15')
    expect(s().progress.dungeon).toEqual({ passed: true, bestScore: 85, passedAt: '2026-10-15', expert: null })
  })
  it('holds a debrief until a topic opens', () => {
    const { s } = setup()
    s().setDungeonDebrief({ topics: ['alpha'] })
    expect(s().dungeonDebrief).toEqual({ topics: ['alpha'] })
    s().openTopic('alpha')
    expect(s().dungeonDebrief).toBeNull()
  })
})

describe('entering the dungeon', () => {
  it('starts on the title screen: an old floor in the route is cleared', () => {
    const { s } = setup()
    s().setDungeonRoute({ floor: 1 })
    s().requestZone('dungeon', 'tv')
    expect(s().dungeonRoute).toEqual({ floor: null })
  })
})
