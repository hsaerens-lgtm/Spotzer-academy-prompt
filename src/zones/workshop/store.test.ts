import { PROGRESS_KEY } from '../../core/progress'
import { createAppStore } from '../../core/store'
import { memoryStorage } from '../../test/memoryStorage'
import { makeReport } from '../../test/workshopFixtures'
import { MISSION_IDS, fakeApi, makeWorkshopStore } from '../../test/workshopStore'
import { getWorkshopContent } from '../../workshop/content'
import { createWorkshopStore } from './store'

const fullLetter = {
  role: 'An account manager at a web agency',
  task: 'Write an email to the client',
  context: 'The client is Martin\'s Bakery. The launch moves to next Friday because the photos arrived late.',
  format: 'Friendly, under 120 words',
}

function fill(store: ReturnType<typeof makeWorkshopStore>, blocks: Record<string, string>) {
  for (const [type, value] of Object.entries(blocks)) store.getState().setBlock('delayed-website', type as never, value)
}

test('every mission has a session; a fix mission starts with its collapsed starter prompt', () => {
  const store = makeWorkshopStore()
  const { sessions } = store.getState()
  expect(Object.keys(sessions)).toEqual(getWorkshopContent('en').missions.map((m) => m.id))
  expect(sessions['delayed-website']).toMatchObject({ draft: { mode: 'blocks', blocks: {} }, first: null, last: null })
  const fix = sessions['plumber-services']
  expect(fix.draft).toEqual({ mode: 'fix', text: 'Write a services page.' })
  expect(fix.last).toMatchObject({ id: 0, evaluation: { tier: 'vague' } })
  expect(fix.first).toBe(fix.last)
})

test('testing records the first and the latest attempt', () => {
  const store = makeWorkshopStore()
  fill(store, { task: 'Write an email' })
  const first = store.getState().test('delayed-website')!
  fill(store, fullLetter)
  const second = store.getState().test('delayed-website')!
  expect(second.id).toBe(first.id + 1)
  const session = store.getState().sessions['delayed-website']
  expect(session.first).toBe(first)
  expect(session.last).toBe(second)
  expect(second.evaluation.passed).toBe(true)
})

// Spec 3.5 / 3.8: the mission is ticked when the building is seen to hold, not while the AI is still reading it.
test('a pass reports the assembled prompt once its result is revealed', () => {
  const passMission = vi.fn()
  const store = makeWorkshopStore({ passMission })
  fill(store, fullLetter)
  const attempt = store.getState().test('delayed-website')!
  expect(attempt.evaluation.passed).toBe(true)
  expect(store.getState().sessions['delayed-website'].revealedAttempt).toBeNull()
  expect(passMission).not.toHaveBeenCalled()
  store.getState().revealAttempt('delayed-website', attempt.id)
  expect(store.getState().sessions['delayed-website'].revealedAttempt).toBe(attempt.id)
  expect(passMission).toHaveBeenCalledWith(
    'delayed-website',
    `Role: ${fullLetter.role}\nTask: ${fullLetter.task}\nContext: ${fullLetter.context}\nFormat: ${fullLetter.format}`,
  )
})

test('only the latest attempt is revealed, once: an older building finishing late records nothing', () => {
  const passMission = vi.fn()
  const store = makeWorkshopStore({ passMission })
  fill(store, fullLetter)
  const first = store.getState().test('delayed-website')!
  const second = store.getState().test('delayed-website')!
  store.getState().revealAttempt('delayed-website', first.id)
  expect(store.getState().sessions['delayed-website'].revealedAttempt).toBeNull()
  expect(passMission).not.toHaveBeenCalled()
  store.getState().revealAttempt('delayed-website', second.id)
  store.getState().revealAttempt('delayed-website', second.id)
  expect(store.getState().sessions['delayed-website'].revealedAttempt).toBe(second.id)
  expect(passMission).toHaveBeenCalledTimes(1)
  // A failing attempt is revealed too, and passes nothing.
  fill(store, { context: '' })
  const third = store.getState().test('delayed-website')!
  store.getState().revealAttempt('delayed-website', third.id)
  expect(store.getState().sessions['delayed-website'].revealedAttempt).toBe(third.id)
  expect(passMission).toHaveBeenCalledTimes(1)
})

// Review focus 2: pressing Build & test twice on a passing prompt writes the progress once.
test('passing twice records once', () => {
  const storage = memoryStorage()
  const app = createAppStore({ getTopic: () => undefined, storage })
  const setItem = vi.spyOn(storage, 'setItem')
  const store = makeWorkshopStore({ passMission: (id, prompt) => app.getState().passWorkshopMission(id, prompt, MISSION_IDS) })
  fill(store, fullLetter)
  const first = store.getState().test('delayed-website')!
  const second = store.getState().test('delayed-website')!
  store.getState().revealAttempt('delayed-website', first.id)
  store.getState().revealAttempt('delayed-website', second.id)
  store.getState().revealAttempt('delayed-website', second.id)
  const third = store.getState().test('delayed-website')!
  store.getState().revealAttempt('delayed-website', third.id)
  expect(setItem.mock.calls.filter(([key]) => key === PROGRESS_KEY)).toHaveLength(1)
})

test('"It\'s already there" re-evaluates the latest attempt and can pass it', () => {
  const passMission = vi.fn()
  const store = makeWorkshopStore({ passMission })
  fill(store, { ...fullLetter, context: "The client is Martin's Bakery. The photos arrived late, new launch soon." })
  expect(store.getState().test('delayed-website')!.evaluation.passed).toBe(false)
  store.getState().alreadyThere('delayed-website', 'new-date')
  const session = store.getState().sessions['delayed-website']
  expect(session.overrides).toEqual(['new-date'])
  expect(session.last!.evaluation.passed).toBe(true)
  expect(passMission).not.toHaveBeenCalled()
  store.getState().revealAttempt('delayed-website', session.last!.id)
  expect(passMission).toHaveBeenCalledTimes(1)
})

test('bonus blocks can be added; reset empties the blocks or restores the starter', () => {
  const store = makeWorkshopStore()
  store.getState().addBlock('delayed-website', 'constraint')
  store.getState().addBlock('delayed-website', 'constraint')
  expect(store.getState().sessions['delayed-website'].addedBlocks).toEqual(['constraint'])
  fill(store, { role: 'x' })
  store.getState().resetDraft('delayed-website')
  expect(store.getState().sessions['delayed-website'].draft).toEqual({ mode: 'blocks', blocks: {} })
  store.getState().setText('newsletter', 'Something else')
  store.getState().resetDraft('newsletter')
  expect(store.getState().sessions['newsletter'].draft).toEqual({ mode: 'fix', text: getWorkshopContent('en').missionById.get('newsletter')!.starter })
})

test('tips are remembered once shown and can be muted', () => {
  const store = makeWorkshopStore()
  store.getState().markTipShown('florist-post', 'role-job')
  store.getState().markTipShown('florist-post', 'role-job')
  store.getState().muteTips('florist-post')
  expect(store.getState().sessions['florist-post']).toMatchObject({ tipsShown: ['role-job'], tipsMuted: true })
})

// Spec 2 section 3.6: each tip appears at most once per attempt, so a recorded attempt starts the next one with a clean slate.
test('a tip shown before an attempt can appear again after it; muting lasts for the mission', () => {
  const store = makeWorkshopStore()
  store.getState().markTipShown('florist-post', 'role-job')
  store.getState().markTipShown('newsletter', 'role-job')
  store.getState().muteTips('florist-post')
  store.getState().test('florist-post')
  expect(store.getState().sessions['florist-post']).toMatchObject({ tipsShown: [], tipsMuted: true })
  expect(store.getState().sessions['newsletter'].tipsShown).toEqual(['role-job'])
  store.getState().markTipShown('florist-post', 'role-job')
  expect(store.getState().sessions['florist-post'].tipsShown).toEqual(['role-job'])
})

// "It's already there" re-evaluates the last attempt: it starts no new typing round, so the tips Ada gave stay given.
test('"It\'s already there" keeps the tips already shown', () => {
  const store = makeWorkshopStore()
  fill(store, { ...fullLetter, context: "The client is Martin's Bakery. The photos arrived late, new launch soon." })
  const attempt = store.getState().test('delayed-website')!
  store.getState().markTipShown('delayed-website', 'role-job')
  store.getState().alreadyThere('delayed-website', 'new-date')
  const session = store.getState().sessions['delayed-website']
  expect(session.last!.id).toBe(attempt.id + 1)
  expect(session.tipsShown).toEqual(['role-job'])
})

test('resetting a draft that is already at its initial state changes nothing', () => {
  const store = makeWorkshopStore()
  const listener = vi.fn()
  store.subscribe(listener)
  const before = store.getState().sessions
  store.getState().resetDraft('delayed-website')
  store.getState().resetDraft('newsletter')
  expect(store.getState().sessions).toBe(before)
  expect(listener).not.toHaveBeenCalled()
  store.getState().setText('newsletter', 'Something else')
  store.getState().resetDraft('newsletter')
  expect(listener).toHaveBeenCalledTimes(2)
})

test('unknown missions are ignored', () => {
  const store = makeWorkshopStore()
  expect(store.getState().test('ghost')).toBeNull()
  expect(() => store.getState().setText('ghost', 'x')).not.toThrow()
})

describe('corrector', () => {
  it('checks the server once and remembers whether it is online', async () => {
    const health = vi.fn().mockResolvedValue({ ok: true, data: { corrector: false } })
    const store = makeWorkshopStore({ api: { health } })
    await Promise.all([store.getState().checkHealth(), store.getState().checkHealth()])
    expect(health).toHaveBeenCalledTimes(1)
    expect(store.getState().corrector.health).toBe('offline')
  })

  // Review focus 3: double submit and failures.
  it('ignores a blank prompt and a second click while checking', async () => {
    let resolve!: (value: unknown) => void
    const correct = vi.fn(() => new Promise((r) => (resolve = r)))
    const store = makeWorkshopStore({ api: { correct: correct as never } })
    await store.getState().checkPrompt()
    expect(correct).not.toHaveBeenCalled()
    store.getState().setCorrectorPrompt('  Write a post  ')
    const pending = store.getState().checkPrompt()
    await store.getState().checkPrompt()
    expect(correct).toHaveBeenCalledTimes(1)
    expect(correct).toHaveBeenCalledWith({ prompt: '  Write a post  ', purpose: undefined, lang: 'en' })
    resolve({ ok: true, data: makeReport() })
    await pending
    expect(store.getState().corrector).toMatchObject({ status: 'done', checkedPrompt: 'Write a post', checks: 1 })
  })

  it('keeps the text and reports the error when a check fails', async () => {
    const store = makeWorkshopStore({ api: { correct: vi.fn().mockResolvedValue({ ok: false, error: 'rate' }) } })
    store.getState().setCorrectorPrompt('Write a post')
    store.getState().setCorrectorPurpose('For a shop')
    await store.getState().checkPrompt()
    expect(store.getState().corrector).toMatchObject({ status: 'error', error: 'rate', prompt: 'Write a post', report: null })
  })

  it('runs the checked prompt and the improved one side by side', async () => {
    const run = vi.fn(async (prompt: string) => ({ ok: true as const, data: { answer: `Answer to: ${prompt}` } }))
    const store = makeWorkshopStore({ api: { correct: vi.fn().mockResolvedValue({ ok: true, data: makeReport() }), run } })
    store.getState().setCorrectorPrompt('Write a post')
    await store.getState().checkPrompt()
    await store.getState().runBoth()
    expect(store.getState().corrector.run).toEqual({
      status: 'done',
      original: 'Answer to: Write a post',
      improved: `Answer to: ${makeReport().improvedPrompt}`,
      originalTruncated: false,
      improvedTruncated: false,
      error: null,
    })
  })

  // Spec 3.9: the answers are capped; the view says which one was cut at the length limit.
  it('keeps which answer was cut at the length limit', async () => {
    const run = vi.fn(async (prompt: string) => ({
      ok: true as const,
      data: prompt === 'Write a post' ? { answer: 'Dear Martin, the', truncated: true } : { answer: 'A whole answer.' },
    }))
    const store = makeWorkshopStore({ api: { run } })
    store.getState().setCorrectorPrompt('Write a post')
    await store.getState().checkPrompt()
    await store.getState().runBoth()
    expect(store.getState().corrector.run).toEqual({
      status: 'done',
      original: 'Dear Martin, the',
      improved: 'A whole answer.',
      originalTruncated: true,
      improvedTruncated: false,
      error: null,
    })
  })

  // The view that shows the report is unmounted while another program is open: the store remembers what it revealed.
  it('remembers the revealed report, for the latest check only', async () => {
    const store = makeWorkshopStore()
    store.getState().setCorrectorPrompt('Write a post')
    await store.getState().checkPrompt()
    expect(store.getState().corrector).toMatchObject({ checks: 1, revealedCheck: 0 })
    store.getState().revealReport(0)
    expect(store.getState().corrector.revealedCheck).toBe(0)
    store.getState().revealReport(1)
    expect(store.getState().corrector.revealedCheck).toBe(1)
    await store.getState().checkPrompt()
    // The newer report waits for its own building: the older one finishing late reveals nothing.
    store.getState().revealReport(1)
    expect(store.getState().corrector).toMatchObject({ checks: 2, revealedCheck: 1 })
    store.getState().revealReport(2)
    expect(store.getState().corrector.revealedCheck).toBe(2)
  })

  it('reports the first error when one of the two runs fails', async () => {
    const run = vi.fn().mockResolvedValueOnce({ ok: true, data: { answer: 'A' } }).mockResolvedValueOnce({ ok: false, error: 'timeout' })
    const store = makeWorkshopStore({ api: { correct: vi.fn().mockResolvedValue({ ok: true, data: makeReport() }), run } })
    store.getState().setCorrectorPrompt('Write a post')
    await store.getState().checkPrompt()
    await store.getState().runBoth()
    expect(store.getState().corrector.run).toMatchObject({ status: 'error', error: 'timeout' })
  })

  // A rejected call (the api layer should not throw, but a bug there must not lock the screen) counts as "unavailable".
  describe('when an api call rejects', () => {
    it('reads as offline, and the health check can be retried', async () => {
      const health = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({ ok: true, data: { corrector: true } })
      const store = makeWorkshopStore({ api: { health } })
      await store.getState().checkHealth()
      expect(store.getState().corrector.health).toBe('offline')
      await store.getState().checkHealth()
      expect(health).toHaveBeenCalledTimes(2)
      expect(store.getState().corrector.health).toBe('online')
    })

    it('ends the check in an unavailable error, and the check can be retried', async () => {
      const correct = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({ ok: true, data: makeReport() })
      const store = makeWorkshopStore({ api: { correct } })
      store.getState().setCorrectorPrompt('Write a post')
      await store.getState().checkPrompt()
      expect(store.getState().corrector).toMatchObject({ status: 'error', error: 'unavailable', prompt: 'Write a post', report: null, checks: 0 })
      await store.getState().checkPrompt()
      expect(correct).toHaveBeenCalledTimes(2)
      expect(store.getState().corrector).toMatchObject({ status: 'done', error: null, checks: 1 })
    })

    it('ends the run in an unavailable error, and the run can be retried', async () => {
      const run = vi
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockImplementation(async (prompt: string) => ({ ok: true, data: { answer: `Answer to: ${prompt}` } }))
      const store = makeWorkshopStore({ api: { run } })
      store.getState().setCorrectorPrompt('Write a post')
      await store.getState().checkPrompt()
      await store.getState().runBoth()
      expect(store.getState().corrector.run).toMatchObject({ status: 'error', error: 'unavailable' })
      await store.getState().runBoth()
      expect(store.getState().corrector.run).toMatchObject({ status: 'done', original: 'Answer to: Write a post', error: null })
    })
  })

  describe('runs and re-checks', () => {
    function pendingRuns() {
      const pending: { prompt: string; resolve: (answer: string) => void }[] = []
      const run = vi.fn(
        (prompt: string) => new Promise((resolve) => pending.push({ prompt, resolve: (answer) => resolve({ ok: true, data: { answer } }) })),
      )
      return { pending, run: run as never }
    }
    const first = makeReport({ improvedPrompt: 'First improved prompt.' })
    const second = makeReport({ score: 90, improvedPrompt: 'Second improved prompt.' })
    const twoReports = () => vi.fn().mockResolvedValueOnce({ ok: true, data: first }).mockResolvedValueOnce({ ok: true, data: second })
    const idle = { status: 'idle', original: null, improved: null, originalTruncated: false, improvedTruncated: false, error: null }

    it('drops the result of a run that started on an older report', async () => {
      const { pending, run } = pendingRuns()
      const store = makeWorkshopStore({ api: { correct: twoReports(), run } })
      store.getState().setCorrectorPrompt('Write a post')
      await store.getState().checkPrompt()
      const stale = store.getState().runBoth()
      await store.getState().checkPrompt()
      expect(store.getState().corrector).toMatchObject({ status: 'done', run: idle })
      for (const call of pending) call.resolve(`Answer to: ${call.prompt}`)
      await stale
      expect(store.getState().corrector.run).toEqual(idle)
      expect(store.getState().corrector.report).toBe(second)
    })

    it('lets a new run start on the new report and keeps only its result', async () => {
      const { pending, run } = pendingRuns()
      const store = makeWorkshopStore({ api: { correct: twoReports(), run } })
      store.getState().setCorrectorPrompt('Write a post')
      await store.getState().checkPrompt()
      const stale = store.getState().runBoth()
      await store.getState().checkPrompt()
      const fresh = store.getState().runBoth()
      expect(pending.map((call) => call.prompt)).toEqual(['Write a post', 'First improved prompt.', 'Write a post', 'Second improved prompt.'])
      pending[0].resolve('stale original')
      pending[1].resolve('stale improved')
      await stale
      expect(store.getState().corrector.run).toMatchObject({ status: 'running' })
      pending[2].resolve('fresh original')
      pending[3].resolve('fresh improved')
      await fresh
      expect(store.getState().corrector.run).toEqual({
        status: 'done',
        original: 'fresh original',
        improved: 'fresh improved',
        originalTruncated: false,
        improvedTruncated: false,
        error: null,
      })
    })

    it('does not start a run while a check is in flight', async () => {
      let resolveCheck!: (value: unknown) => void
      const correct = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, data: first })
        .mockImplementationOnce(() => new Promise((resolve) => (resolveCheck = resolve)))
      const { pending, run } = pendingRuns()
      const store = makeWorkshopStore({ api: { correct, run } })
      store.getState().setCorrectorPrompt('Write a post')
      await store.getState().checkPrompt()
      const check = store.getState().checkPrompt()
      await store.getState().runBoth()
      expect(pending).toHaveLength(0)
      expect(store.getState().corrector.run).toEqual(idle)
      resolveCheck({ ok: true, data: second })
      await check
      expect(store.getState().corrector).toMatchObject({ status: 'done', checks: 2 })
    })
  })
})

test('the store can be created with any content', () => {
  const store = createWorkshopStore({ content: getWorkshopContent('en'), passMission: () => {}, api: fakeApi() })
  expect(store.getState().announcement).toBe('')
  store.getState().announce('Hello')
  expect(store.getState().announcement).toBe('Hello')
})
