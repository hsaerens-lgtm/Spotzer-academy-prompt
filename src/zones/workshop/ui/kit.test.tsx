import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../../../core/store'
import { resetAppStore } from '../../../test/resetAppStore'
import { makeWorkshopStore } from '../../../test/workshopStore'
import { WorkshopStoreProvider } from '../store'
import { AdaBubble } from '../ada/AdaBubble'
import { WorkshopAnnouncer } from '../WorkshopAnnouncer'
import { BevelButton } from './BevelButton'
import { DesktopIcons } from './DesktopIcons'
import { Taskbar } from './Taskbar'
import { Window } from './Window'

beforeEach(() => resetAppStore())

test('a window is a section named by its title bar', () => {
  render(
    <Window title="MISSIONS.EXE" tools={<span>2/6</span>}>
      <p>Body</p>
    </Window>,
  )
  const section = screen.getByRole('region', { name: 'MISSIONS.EXE' })
  expect(within(section).getByText('Body')).toBeInTheDocument()
  expect(within(section).getByText('2/6')).toBeInTheDocument()
})

test('bevel buttons are plain buttons by default', () => {
  render(<BevelButton tone="primary">Go</BevelButton>)
  const button = screen.getByRole('button', { name: 'Go' })
  expect(button).toHaveAttribute('type', 'button')
  expect(button).toHaveClass('ws-btn', 'ws-btn--primary')
})

test('the taskbar switches programs, toggles sound and goes back to the office', async () => {
  const onView = vi.fn()
  const onBack = vi.fn()
  render(<Taskbar view="missions" passed={2} total={6} onView={onView} onBack={onBack} />)
  const bar = screen.getByRole('navigation', { name: 'Taskbar' })
  expect(within(bar).getByText('2/6 missions')).toBeInTheDocument()
  expect(within(bar).getByRole('button', { name: 'Missions' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(within(bar).getByRole('button', { name: 'Corrector' }))
  expect(onView).toHaveBeenCalledWith('corrector')
  // A toggle keeps its name; aria-pressed says whether it is on.
  const sound = within(bar).getByRole('button', { name: 'Sound' })
  expect(sound).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(sound)
  expect(appStore.getState().settings.sound).toBe(false)
  expect(sound).toHaveAttribute('aria-pressed', 'false')
  expect(sound).toHaveAccessibleName('Sound')
  await userEvent.click(sound)
  expect(appStore.getState().settings.sound).toBe(true)
  expect(sound).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(within(bar).getByRole('button', { name: /Back to the office/ }))
  expect(onBack).toHaveBeenCalled()
})

test('the ATHENA start menu opens, closes with Escape and runs its items', async () => {
  const onView = vi.fn()
  render(<Taskbar view="missions" passed={0} total={6} onView={onView} onBack={() => {}} />)
  const start = screen.getByRole('button', { name: 'ATHENA' })
  await userEvent.click(start)
  expect(start).toHaveAttribute('aria-expanded', 'true')
  const menu = screen.getByRole('list', { name: 'Athena menu' })
  await userEvent.click(within(menu).getByRole('button', { name: 'My prompts' }))
  expect(onView).toHaveBeenCalledWith('prompts')
  expect(screen.queryByRole('list', { name: 'Athena menu' })).not.toBeInTheDocument()
  await userEvent.click(start)
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('list', { name: 'Athena menu' })).not.toBeInTheDocument()
})

test('Escape closes the open start menu first and only then dismisses Ada', async () => {
  resetAppStore({ reducedMotion: true })
  const onDismiss = vi.fn()
  render(
    <>
      <Taskbar view="missions" passed={0} total={6} onView={() => {}} onBack={() => {}} />
      <AdaBubble text="Hello." onDismiss={onDismiss} />
    </>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'ATHENA' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('list', { name: 'Athena menu' })).not.toBeInTheDocument()
  expect(onDismiss).not.toHaveBeenCalled()
  await userEvent.keyboard('{Escape}')
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('a menu opened with the mouse still closes with Escape, gives focus to ATHENA and spares Ada', async () => {
  resetAppStore({ reducedMotion: true })
  const onDismiss = vi.fn()
  render(
    <>
      <Taskbar view="missions" passed={0} total={6} onView={() => {}} onBack={() => {}} />
      <AdaBubble text="Hello." onDismiss={onDismiss} />
    </>,
  )
  const start = screen.getByRole('button', { name: 'ATHENA' })
  // Safari and Firefox on macOS do not focus a button on click: nothing has focus when the menu opens.
  fireEvent.click(start)
  expect(screen.getByRole('list', { name: 'Athena menu' })).toBeInTheDocument()
  expect(start).not.toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('list', { name: 'Athena menu' })).not.toBeInTheDocument()
  expect(onDismiss).not.toHaveBeenCalled()
  expect(start).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('picking a start menu item gives focus back to the ATHENA button', async () => {
  const onBack = vi.fn()
  render(<Taskbar view="missions" passed={0} total={6} onView={() => {}} onBack={onBack} />)
  const start = screen.getByRole('button', { name: 'ATHENA' })
  await userEvent.click(start)
  await userEvent.click(within(screen.getByRole('list', { name: 'Athena menu' })).getByRole('button', { name: 'Corrector' }))
  expect(screen.queryByRole('list', { name: 'Athena menu' })).not.toBeInTheDocument()
  expect(start).toHaveFocus()
  await userEvent.click(start)
  await userEvent.click(within(screen.getByRole('list', { name: 'Athena menu' })).getByRole('button', { name: 'Back to the office' }))
  expect(onBack).toHaveBeenCalledTimes(1)
  expect(start).toHaveFocus()
})

test('tabbing out of the start menu closes it, and the focus is not pulled back', async () => {
  render(<Taskbar view="missions" passed={0} total={6} onView={() => {}} onBack={() => {}} />)
  const start = screen.getByRole('button', { name: 'ATHENA' })
  await userEvent.click(start)
  const menu = screen.getByRole('list', { name: 'Athena menu' })
  for (let i = 0; i < 4; i++) await userEvent.tab() // the four menu items stay inside the menu
  expect(within(menu).getByRole('button', { name: 'Back to the office' })).toHaveFocus()
  expect(screen.getByRole('list', { name: 'Athena menu' })).toBeInTheDocument()
  await userEvent.tab()
  expect(screen.queryByRole('list', { name: 'Athena menu' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Missions' })).toHaveFocus()
})

test('pressing the mouse inside the open menu keeps focus where it is, so the click still lands', async () => {
  render(<Taskbar view="missions" passed={0} total={6} onView={() => {}} onBack={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'ATHENA' }))
  const item = within(screen.getByRole('list', { name: 'Athena menu' })).getByRole('button', { name: 'My prompts' })
  // Prevented default: Safari would otherwise blur the trigger first and close the menu before the click.
  expect(fireEvent.mouseDown(item)).toBe(false)
  expect(screen.getByRole('list', { name: 'Athena menu' })).toBeInTheDocument()
})

test('desktop icons open their program', async () => {
  const onOpen = vi.fn()
  render(<DesktopIcons onOpen={onOpen} />)
  await userEvent.click(within(screen.getByRole('group', { name: 'Workshop desktop' })).getByRole('button', { name: 'Corrector' }))
  expect(onOpen).toHaveBeenCalledWith('corrector')
})

test('the announcer is the workshop live region', () => {
  const store = makeWorkshopStore()
  store.getState().announce('The building holds.')
  render(
    <WorkshopStoreProvider value={store}>
      <WorkshopAnnouncer />
    </WorkshopStoreProvider>,
  )
  const region = screen.getByTestId('workshop-announcer')
  expect(region).toHaveAttribute('aria-live', 'polite')
  expect(region).toHaveTextContent('The building holds.')
})

test('the same announcement made twice is a new message for the live region', () => {
  const store = makeWorkshopStore()
  render(
    <WorkshopStoreProvider value={store}>
      <WorkshopAnnouncer />
    </WorkshopStoreProvider>,
  )
  const region = screen.getByTestId('workshop-announcer')
  act(() => store.getState().announce('The AI took too long to answer. Try again.'))
  const first = region.firstElementChild
  act(() => store.getState().announce('The AI took too long to answer. Try again.'))
  expect(region).toHaveTextContent('The AI took too long to answer. Try again.')
  expect(region.firstElementChild).not.toBe(first)
})
