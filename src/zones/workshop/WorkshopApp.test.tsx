import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { startRouter } from '../../core/router'
import { appStore } from '../../core/store'
import { resetAppStore } from '../../test/resetAppStore'
import { makeReport } from '../../test/workshopFixtures'
import { getWorkshopStore, resetWorkshopStore } from './instance'
import { WorkshopApp } from './WorkshopApp'

async function renderApp() {
  return act(async () => render(<WorkshopApp />))
}

beforeEach(() => {
  resetAppStore({ zone: 'workshop', webgl: 'unavailable', reducedMotion: true })
  resetWorkshopStore()
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('no server in tests'))))
})
afterEach(() => vi.unstubAllGlobals())

test('opens on the suggested mission and writes it into the route', async () => {
  await renderApp()
  expect(screen.getByRole('region', { name: 'MISSIONS.EXE' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'PROMPT_STUDIO.EXE \u2014 MISSION 1' })).toBeInTheDocument()
  expect(appStore.getState().workshopRoute).toEqual({ mission: 'delayed-website', app: null })
})

test('an unknown mission in the URL falls back to the suggested one', async () => {
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt', 6)
  appStore.getState().setWorkshopRoute({ mission: 'ghost', app: null })
  await renderApp()
  expect(appStore.getState().workshopRoute.mission).toBe('meeting-notes')
  expect(screen.getByRole('region', { name: 'PROMPT_STUDIO.EXE \u2014 MISSION 2' })).toBeInTheDocument()
})

test('the mission list and the programs drive the route', async () => {
  const user = userEvent.setup()
  await renderApp()
  await user.click(within(screen.getByRole('navigation', { name: 'Missions' })).getByRole('button', { name: /The vague Services page/ }))
  expect(appStore.getState().workshopRoute).toEqual({ mission: 'plumber-services', app: null })
  await user.click(within(screen.getByRole('group', { name: 'Workshop desktop' })).getByRole('button', { name: 'Corrector' }))
  expect(appStore.getState().workshopRoute).toEqual({ mission: 'plumber-services', app: 'corrector' })
  expect(await screen.findByText('The corrector is offline.')).toBeInTheDocument()
  await user.click(within(screen.getByRole('navigation', { name: 'Taskbar' })).getByRole('button', { name: 'My prompts' }))
  expect(screen.getByRole('region', { name: 'MY_PROMPTS.TXT' })).toBeInTheDocument()
})

// Review focus 4: leaving the workshop and coming back keeps the drafts of this session.
test('keeps drafts when leaving and coming back', async () => {
  const user = userEvent.setup()
  const { unmount } = await renderApp()
  await user.type(screen.getByRole('textbox', { name: 'Role block' }), 'A writer')
  unmount()
  await renderApp()
  expect(screen.getByRole('textbox', { name: 'Role block' })).toHaveValue('A writer')
})

test('the taskbar counts passed missions and goes back to the office', async () => {
  const user = userEvent.setup()
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt', 6)
  await renderApp()
  const bar = within(screen.getByRole('navigation', { name: 'Taskbar' }))
  expect(bar.getByText('1/6 missions')).toBeInTheDocument()
  await user.click(bar.getByRole('button', { name: 'Back to the office' }))
  expect(appStore.getState().transition).toEqual({ to: 'office', via: null, stage: 'fade' })
})

test('works in plan view without WebGL', async () => {
  const user = userEvent.setup()
  await renderApp()
  await user.type(screen.getByRole('textbox', { name: 'Task block' }), 'Write an email')
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(screen.getByRole('list', { name: /Plan view/ })).toBeInTheDocument()
  expect(screen.getByText('COLLAPSED \u00B7 VAGUE')).toBeInTheDocument()
})

const missionList = () => within(screen.getByRole('navigation', { name: 'Missions' }))
const ada = () => within(screen.getByRole('complementary', { name: 'Ada' }))

test('the list marks the current, the passed and the suggested missions', async () => {
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt', 6)
  appStore.getState().setWorkshopRoute({ mission: 'florist-post', app: null })
  await renderApp()
  expect(missionList().getByRole('button', { name: /A post for a florist/ })).toHaveAttribute('aria-current', 'true')
  expect(missionList().getByRole('button', { name: /The delayed website \(passed\)/ })).toBeInTheDocument()
  expect(missionList().getByRole('button', { name: /Meeting notes for your manager.*Start here/ })).toBeInTheDocument()
})

// Spec 3.2: My prompts and the corrector open in place of the centre and right windows; the mission list stays.
test('the mission list stays in every program, and a mission picked from it keeps the focus', async () => {
  const user = userEvent.setup()
  await renderApp()
  const desktop = within(screen.getByRole('group', { name: 'Workshop desktop' }))
  await user.click(desktop.getByRole('button', { name: 'My prompts' }))
  expect(screen.getByRole('region', { name: 'MY_PROMPTS.TXT' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'MISSIONS.EXE' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: /PROMPT_STUDIO\.EXE/ })).not.toBeInTheDocument()
  await user.click(desktop.getByRole('button', { name: 'Corrector' }))
  expect(await screen.findByText('The corrector is offline.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'MISSIONS.EXE' })).toBeInTheDocument()

  const florist = missionList().getByRole('button', { name: /A post for a florist/ })
  await user.click(florist)
  expect(appStore.getState().workshopRoute).toEqual({ mission: 'florist-post', app: null })
  expect(screen.getByRole('region', { name: 'PROMPT_STUDIO.EXE \u2014 MISSION 3' })).toBeInTheDocument()
  expect(florist).toHaveFocus()
  const meeting = missionList().getByRole('button', { name: /Meeting notes for your manager/ })
  await user.click(meeting)
  expect(screen.getByRole('region', { name: 'PROMPT_STUDIO.EXE \u2014 MISSION 2' })).toBeInTheDocument()
  expect(meeting).toHaveFocus()
})

// Task 9 note: each mission gets a fresh view, so what Ada said about one mission never follows to the next.
test('a mission opened from the list starts with its own Ada', async () => {
  const user = userEvent.setup()
  await renderApp()
  await user.type(screen.getByRole('textbox', { name: 'Task block' }), 'Write an email')
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  await user.click(ada().getByRole('button', { name: "It's already there" }))
  expect(ada().getByText(/Sorry, I missed it!/, { selector: '.sr-only' })).toBeInTheDocument()
  await user.click(missionList().getByRole('button', { name: /Meeting notes for your manager/ }))
  expect(screen.getByRole('region', { name: 'PROMPT_STUDIO.EXE \u2014 MISSION 2' })).toBeInTheDocument()
  expect(ada().queryByText(/Sorry, I missed it!/, { selector: '.sr-only' })).not.toBeInTheDocument()
})

// Task 10 note: coming back to a passed mission shows its result again, but never reports the pass a second time.
test('switching missions and coming back does not report the pass again', async () => {
  const user = userEvent.setup()
  const writes = vi.fn()
  const unsubscribe = appStore.subscribe((state, previous) => {
    if (state.progress !== previous.progress) writes()
  })
  try {
    await renderApp()
    const letter = {
      'Role block': 'An account manager at a web agency',
      'Task block': 'Write an email to the client',
      'Context block': "The client is Martin's Bakery. The launch moves to next Friday because the photos arrived late.",
      'Format block': 'Friendly and apologetic, under 120 words',
    }
    for (const [name, value] of Object.entries(letter)) {
      await user.click(screen.getByRole('textbox', { name }))
      await user.paste(value)
    }
    await user.click(screen.getByRole('button', { name: 'Build & test' }))
    expect(screen.getByText('HOLDS \u00B7 EXCELLENT')).toBeInTheDocument()
    expect(appStore.getState().progress.workshop?.passed).toEqual(['delayed-website'])
    expect(writes).toHaveBeenCalledTimes(1)
    await user.click(missionList().getByRole('button', { name: /Meeting notes for your manager/ }))
    await user.click(missionList().getByRole('button', { name: /The delayed website/ }))
    expect(screen.getByText('HOLDS \u00B7 EXCELLENT')).toBeInTheDocument()
    expect(writes).toHaveBeenCalledTimes(1)
  } finally {
    unsubscribe()
  }
})

// Escape never leaves the workshop: it closes the Athena menu first, then Ada's bubble.
test("Escape closes the Athena menu first, then Ada's bubble", async () => {
  const user = userEvent.setup()
  await renderApp()
  const bar = within(screen.getByRole('navigation', { name: 'Taskbar' }))
  expect(ada().getByRole('button', { name: 'Close' })).toBeInTheDocument()
  await user.click(bar.getByRole('button', { name: 'ATHENA' }))
  expect(bar.getByRole('list', { name: 'Athena menu' })).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(bar.queryByRole('list', { name: 'Athena menu' })).not.toBeInTheDocument()
  expect(ada().getByRole('button', { name: 'Close' })).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(ada().queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  expect(appStore.getState()).toMatchObject({ zone: 'workshop', transition: null })
})

// Task 6 note: the zone fills in a missing mission; the router replaces the entry, so Back still leaves the workshop.
test('a missing mission is filled into the URL without a history entry', async () => {
  window.history.replaceState(null, '', '#/workshop')
  const stop = startRouter(appStore)
  try {
    const before = window.history.length
    await renderApp()
    expect(window.location.hash).toBe('#/workshop?mission=delayed-website')
    expect(window.history.length).toBe(before)
  } finally {
    stop()
    window.history.replaceState(null, '', '#')
  }
})

/** The corrector's server, answering like the real one: online, and a report for every check. */
function stubServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      const body = path.endsWith('api/health') ? { corrector: true } : makeReport()
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
}

// Task 14 note: reopening the corrector shows its last report at once; it is not built or announced a second time.
test('the corrector keeps its report across programs without announcing it again', async () => {
  stubServer()
  const user = userEvent.setup()
  appStore.getState().setWorkshopRoute({ mission: null, app: 'corrector' })
  await renderApp()
  await user.type(await screen.findByRole('textbox', { name: 'Paste or write any prompt' }), 'Write a post')
  await user.click(screen.getByRole('button', { name: 'Check my prompt' }))
  expect(await screen.findByText('62/100 \u00B7 Leans')).toBeInTheDocument()
  await waitFor(() => expect(getWorkshopStore().getState().announcement).toBe('62/100. Leans. The building leans: the context floor is thin.'))
  const said = getWorkshopStore().getState().announcements

  const bar = within(screen.getByRole('navigation', { name: 'Taskbar' }))
  await user.click(bar.getByRole('button', { name: 'My prompts' }))
  expect(screen.queryByText('62/100 \u00B7 Leans')).not.toBeInTheDocument()
  await user.click(bar.getByRole('button', { name: 'Corrector' }))
  expect(screen.getByText('62/100 \u00B7 Leans')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Paste or write any prompt' })).toHaveValue('Write a post')
  expect(getWorkshopStore().getState().announcements).toBe(said)
})

// Development only: the end-to-end tests read the workshop state while it is open.
test('exposes the workshop state to the test API while it is open', async () => {
  window.__academy = { state: () => appStore.getState(), clickObject: () => {} }
  try {
    const { unmount } = await renderApp()
    expect(window.__academy.workshop?.()).toBe(getWorkshopStore().getState())
    unmount()
    expect(window.__academy.workshop).toBeUndefined()
  } finally {
    delete window.__academy
  }
})
