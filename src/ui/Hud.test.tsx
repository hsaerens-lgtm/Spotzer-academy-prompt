import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore, type AppState } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { Hud } from './Hud'

const total = getContent('en').topics.length

beforeEach(() => resetAppStore())

test('shows the site name and the progress counter', () => {
  render(<Hud />)
  expect(screen.getByText('Athena Prompt Academy')).toBeInTheDocument()
  expect(screen.getByTestId('progress')).toHaveTextContent(`0/${total} topics`)
  act(() => appStore.setState({ progress: { ...appStore.getState().progress, topicsSeen: ['what-is-ai', 'ghost'] } }))
  expect(screen.getByTestId('progress')).toHaveTextContent(`1/${total} topics`)
})

test('toggles sound', async () => {
  render(<Hud />)
  const button = screen.getByRole('button', { name: 'Sound on' })
  expect(button).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(button)
  expect(appStore.getState().settings.sound).toBe(false)
  expect(screen.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false')
})

test('toggles reading mode only when 3D is available', async () => {
  const { unmount } = render(<Hud />)
  await userEvent.click(screen.getByRole('button', { name: 'Reading mode' }))
  expect(appStore.getState().readingMode).toBe(true)
  expect(screen.getByRole('button', { name: '3D mode' })).toBeInTheDocument()
  unmount()
  resetAppStore({ webgl: 'unavailable' })
  render(<Hud />)
  expect(screen.queryByRole('button', { name: 'Reading mode' })).not.toBeInTheDocument()
})

test('offers the available languages', () => {
  render(<Hud />)
  expect(screen.getByRole('combobox', { name: /Language/ })).toHaveValue('en')
})

test('is hidden in the workshop, whose taskbar replaces it', () => {
  appStore.setState({ zone: 'workshop' })
  const { container } = render(<Hud />)
  expect(container).toBeEmptyDOMElement()
})

// The HUD (z-index 20) sits above the overlay (z-index 10): an aria-modal dialog must not leave it clickable or focusable.
test('the HUD is inert while the expanded view is open', () => {
  render(<Hud />)
  const hud = screen.getByRole('banner')
  expect(hud).not.toHaveAttribute('inert')
  act(() => {
    appStore.getState().openTopic('what-is-ai')
    appStore.getState().setExpandOpen(true)
  })
  expect(hud).toHaveAttribute('inert')
  act(() => appStore.getState().setExpandOpen(false))
  expect(hud).not.toHaveAttribute('inert')
})

test('the Time of day button advances the phase', async () => {
  resetAppStore({ phase: 'day', phaseTransition: null })
  render(<Hud />)
  await userEvent.click(screen.getByRole('button', { name: 'Time of day' }))
  expect(appStore.getState().phase).toBe('sunset')
})

test('the Time of day button only shows in the 3D office', () => {
  const hidden: [string, Partial<AppState>][] = [
    ['reading mode', { readingMode: true }],
    ['no WebGL', { webgl: 'unavailable' }],
    // The dungeon, not the workshop: the workshop has no HUD at all, so it would not test the zone check.
    ['another zone', { zone: 'dungeon' }],
  ]
  for (const [name, overrides] of hidden) {
    resetAppStore(overrides)
    const { unmount } = render(<Hud />)
    // The HUD is there, without the button.
    expect(screen.getByRole('banner'), name).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Time of day' }), name).not.toBeInTheDocument()
    unmount()
  }
  resetAppStore()
  render(<Hud />)
  expect(screen.getByRole('button', { name: 'Time of day' })).toBeInTheDocument()
})
