import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../../core/store'
import { getDungeonContent } from '../../dungeon/content'
import { correctIds, options } from '../../dungeon/questions'
import { resetAppStore } from '../../test/resetAppStore'
import { DungeonApp } from './DungeonApp'
import { createDungeonStore, DungeonStoreProvider } from './store'
import { BossPanel } from './ui/BossPanel'
import { DialogBox } from './ui/DialogBox'

// The 3D canvas itself needs WebGL: a stand-in keeps the context-loss callback the view hands it.
const canvas = vi.hoisted(() => ({ onContextLost: null as null | (() => void) }))
vi.mock('./scene/DungeonCanvas', () => ({
  default: ({ onContextLost }: { onContextLost: () => void }) => {
    canvas.onContextLost = onContextLost
    return null
  },
}))

beforeEach(() => resetAppStore({ zone: 'dungeon', webgl: 'unavailable', reducedMotion: true }))

const renderApp = () => act(async () => render(<DungeonApp />))

test('the title screen warns about what is left and opens floor 1', async () => {
  const user = userEvent.setup()
  await renderApp()
  expect(screen.getByText(/13 topics and 6 workshop missions left/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Floor 2/ })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Enter anyway' }))
  expect(appStore.getState().dungeonRoute).toEqual({ floor: 1 })
})

test('floor 2 from the URL without floor 1 falls back to the title screen', async () => {
  appStore.getState().setDungeonRoute({ floor: 2 })
  await renderApp()
  expect(appStore.getState().dungeonRoute).toEqual({ floor: null })
})

test('in text mode a guardian asks; an empty answer is refused, a digit picks and Enter answers', async () => {
  const user = userEvent.setup()
  appStore.getState().setDungeonRoute({ floor: 1 })
  await renderApp()
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  const dialog = screen.getByRole('dialog', { name: /The Gatekeeper/ })
  await user.click(within(dialog).getByRole('button', { name: 'Answer' }))
  expect(within(dialog).getByText('Pick an answer first.')).toBeInTheDocument()
  await user.keyboard('1')
  expect(within(dialog).getAllByRole('radio')[0]).toBeChecked()
  await user.keyboard('{Enter}')
  expect(within(dialog).getByText(/^(Correct|Wrong)\.$/)).toBeInTheDocument()
})

test('a multi question needs at least one tick, and a partial pick is wrong', async () => {
  const user = userEvent.setup()
  const content = getDungeonContent('en')
  const store = createDungeonStore({ content, seed: () => 1, onVictory: vi.fn(), onEjected: vi.fn() })
  store.getState().start(2)
  const multi = content.floors[2].pools.flatMap((pool) => pool.questions).find((q) => q.type === 'multi')!
  const run = store.getState().run!
  const asked = [{ question: multi, order: options(multi).map((o) => o.id) }, ...run.asked.slice(1)]
  store.setState({ run: { ...run, asked, phase: 'encounter', current: 0 } })
  render(
    <DungeonStoreProvider value={store}>
      <DialogBox />
    </DungeonStoreProvider>,
  )
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Select all that apply.')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Answer' }))
  expect(within(dialog).getByText('Tick at least one answer first.')).toBeInTheDocument()
  expect(store.getState().run!.phase).toBe('encounter')
  const firstRight = options(multi).findIndex((o) => correctIds(multi).includes(o.id))
  await user.click(within(dialog).getAllByRole('checkbox')[firstRight])
  await user.click(within(dialog).getByRole('button', { name: 'Answer' }))
  expect(store.getState().run!.answers[0].correct).toBe(false)
})

test('the dungeon has its own Sound toggle, on the title screen and in the HUD', async () => {
  const user = userEvent.setup()
  await renderApp()
  const toggle = screen.getByRole('button', { name: 'Sound' })
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await user.click(toggle)
  expect(appStore.getState().settings.sound).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Enter anyway' }))
  expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false')
})

test('a passed floor offers its certificate again from the title screen', async () => {
  const user = userEvent.setup()
  appStore.getState().passDungeonFloor(1, 80, '2026-10-15')
  await renderApp()
  expect(screen.queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /expert certificate again/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Download my certificate again (floor 1)' }))
  expect(screen.getByRole('textbox', { name: 'Your name' })).toBeInTheDocument()
})

// Development only: the end-to-end tests read and play the run through window.__academy.
test('exposes the run to the test API while the dungeon is open', async () => {
  window.__academy = { state: () => appStore.getState(), clickObject: () => {}, setPhase: () => {}, rail: () => {} }
  try {
    appStore.getState().setDungeonRoute({ floor: 1 })
    const { unmount } = await act(async () => render(<DungeonApp />))
    act(() => window.__academy!.dungeonAdvance!())
    expect((window.__academy.dungeon!() as { phase: string }).phase).toBe('encounter')
    act(() => window.__academy!.dungeonAnswer!(false))
    expect((window.__academy.dungeon!() as { hearts: number }).hearts).toBe(2)
    unmount()
    expect(window.__academy.dungeon).toBeUndefined()
  } finally {
    delete window.__academy
  }
})

// Final review, finding 1: tearing a canvas down loses its context on purpose; that must not switch later runs to text.
test('leaving the 3D view (back to the title) and its context loss do not switch the next run to text', async () => {
  resetAppStore({ zone: 'dungeon', webgl: 'ok', reducedMotion: true })
  appStore.getState().setDungeonRoute({ floor: 1 })
  await renderApp()
  await act(async () => {})
  expect(canvas.onContextLost).not.toBeNull()
  const lose = canvas.onContextLost!
  act(() => appStore.getState().setDungeonRoute({ floor: null }))
  expect(screen.getByRole('heading', { name: 'THE DUNGEON' })).toBeInTheDocument()
  // The old canvas's renderer is disposed after the view has gone: its context-loss event arrives now.
  act(() => lose())
  expect(screen.getByTestId('dungeon-announcer')).not.toHaveTextContent('The 3D view stopped')
  act(() => appStore.getState().setDungeonRoute({ floor: 1 }))
  await act(async () => {})
  expect(screen.queryByText('A narrow corridor. Torches flicker.')).not.toBeInTheDocument()
})

/** A store whose run is facing its first guardian on `floor`. */
function facingFirstGuardian(floor: 1 | 2) {
  const store = createDungeonStore({ content: getDungeonContent('en'), seed: () => 3, onVictory: vi.fn(), onEjected: vi.fn() })
  store.getState().start(floor)
  store.getState().dispatch({ type: 'advance' })
  return store
}
/** Ticks the right answers (or one wrong one) in the open dialog, by their place on screen, and answers. */
async function answerInDialog(user: ReturnType<typeof userEvent.setup>, store: ReturnType<typeof facingFirstGuardian>, right: boolean) {
  const run = store.getState().run!
  const { question, order } = run.asked[run.current!]
  const good = correctIds(question)
  const picks = right ? good : [order.find((id) => !good.includes(id))!]
  const dialog = within(screen.getByRole('dialog'))
  const inputs = dialog.getAllByRole(question.type === 'multi' ? 'checkbox' : 'radio')
  for (const id of picks) await user.click(inputs[order.indexOf(id)])
  await user.click(dialog.getByRole('button', { name: 'Answer' }))
}

// Final review, finding 4: the live region says how many hearts are left, and that a beaten guardian fades away.
test('a wrong answer announces the hearts left; a right one, that the guardian fades away', async () => {
  const user = userEvent.setup()
  const wrong = facingFirstGuardian(1)
  const { unmount } = render(
    <DungeonStoreProvider value={wrong}>
      <DialogBox />
    </DungeonStoreProvider>,
  )
  await answerInDialog(user, wrong, false)
  expect(wrong.getState().announcement?.text).toMatch(/^Wrong\..*2 hearts left/)
  unmount()
  const right = facingFirstGuardian(1)
  render(
    <DungeonStoreProvider value={right}>
      <DialogBox />
    </DungeonStoreProvider>,
  )
  await answerInDialog(user, right, true)
  expect(right.getState().announcement?.text).toMatch(/^Correct\. The Gatekeeper fades away\./)
})

// Final review, finding 7: spec 3.3 shows a beaten guardian's line on both floors (the expert floor only holds back
// the explanations of wrong answers).
test("on the expert floor a right answer shows the guardian's line", async () => {
  const user = userEvent.setup()
  const store = facingFirstGuardian(2)
  const guardian = getDungeonContent('en').floors[2].guardians[0]
  render(
    <DungeonStoreProvider value={store}>
      <DialogBox />
    </DungeonStoreProvider>,
  )
  await answerInDialog(user, store, true)
  expect(within(screen.getByRole('dialog')).getByText(guardian.line)).toBeInTheDocument()
})

test('a boss hit announces the hearts left', async () => {
  const store = createDungeonStore({ content: getDungeonContent('en'), seed: () => 3, onVictory: vi.fn(), onEjected: vi.fn() })
  store.getState().start(1)
  const run = store.getState().run!
  store.setState({ run: { ...run, defeated: run.defeated.map(() => true), phase: 'boss' } })
  store.getState().dispatch({ type: 'bossResult', text: 'Write an about page.', tier: 'vague', passed: false })
  await act(async () =>
    render(
      <DungeonStoreProvider value={store}>
        <BossPanel />
      </DungeonStoreProvider>,
    ),
  )
  expect(store.getState().announcement?.text).toMatch(/strikes back\. You lose a heart\. 2 hearts left\./)
})
