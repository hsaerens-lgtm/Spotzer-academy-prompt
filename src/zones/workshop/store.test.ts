import { PROGRESS_KEY } from '../../core/progress'
import { createAppStore } from '../../core/store'
import { memoryStorage } from '../../test/memoryStorage'
import { makeReport } from '../../test/workshopFixtures'
import { fakeApi, makeWorkshopStore } from '../../test/workshopStore'
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

test('a pass reports the assembled prompt', () => {
  const passMission = vi.fn()
  const store = makeWorkshopStore({ passMission })
  fill(store, fullLetter)
  store.getState().test('delayed-website')
  expect(passMission).toHaveBeenCalledWith(
    'delayed-website',
    `Role: ${fullLetter.role}\nTask: ${fullLetter.task}\nContext: ${fullLetter.context}\nFormat: ${fullLetter.format}`,
  )
})

// Review focus 2: pressing Build & test twice on a passing prompt writes the progress once.
test('passing twice records once', () => {
  const storage = memoryStorage()
  const app = createAppStore({ getTopic: () => undefined, storage })
  const setItem = vi.spyOn(storage, 'setItem')
  const store = makeWorkshopStore({ passMission: (id, prompt) => app.getState().passWorkshopMission(id, prompt, 6) })
  fill(store, fullLetter)
  store.getState().test('delayed-website')
  store.getState().test('delayed-website')
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
      error: null,
    })
  })

  it('reports the first error when one of the two runs fails', async () => {
    const run = vi.fn().mockResolvedValueOnce({ ok: true, data: { answer: 'A' } }).mockResolvedValueOnce({ ok: false, error: 'timeout' })
    const store = makeWorkshopStore({ api: { correct: vi.fn().mockResolvedValue({ ok: true, data: makeReport() }), run } })
    store.getState().setCorrectorPrompt('Write a post')
    await store.getState().checkPrompt()
    await store.getState().runBoth()
    expect(store.getState().corrector.run).toMatchObject({ status: 'error', error: 'timeout' })
  })
})

test('the store can be created with any content', () => {
  const store = createWorkshopStore({ content: getWorkshopContent('en'), passMission: () => {}, api: fakeApi() })
  expect(store.getState().announcement).toBe('')
  store.getState().announce('Hello')
  expect(store.getState().announcement).toBe('Hello')
})
