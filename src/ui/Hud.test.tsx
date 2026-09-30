import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
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
