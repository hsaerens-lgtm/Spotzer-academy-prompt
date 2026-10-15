import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../../core/store'
import { getDungeonContent } from '../../dungeon/content'
import { correctIds, options } from '../../dungeon/questions'
import { resetAppStore } from '../../test/resetAppStore'
import { DungeonApp } from './DungeonApp'
import { createDungeonStore, DungeonStoreProvider } from './store'
import { DialogBox } from './ui/DialogBox'

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
