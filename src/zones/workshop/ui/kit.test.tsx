import { render, screen, within } from '@testing-library/react'
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
  await userEvent.click(within(bar).getByRole('button', { name: 'Sound on' }))
  expect(appStore.getState().settings.sound).toBe(false)
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
