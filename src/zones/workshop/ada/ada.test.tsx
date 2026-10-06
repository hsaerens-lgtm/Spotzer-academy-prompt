import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { sound } from '../../../core/sound'
import { resetAppStore } from '../../../test/resetAppStore'
import { Ada2D } from './Ada2D'
import { AdaBubble } from './AdaBubble'

beforeEach(() => resetAppStore())
afterEach(() => vi.useRealTimers())

test('Ada shows her mood and can point', () => {
  const { container } = render(<Ada2D mood="thinking" pointing />)
  const svg = container.querySelector('svg')!
  expect(svg).toHaveAttribute('aria-hidden', 'true')
  expect(svg).toHaveAttribute('data-mood', 'thinking')
  expect(svg).toHaveClass('ws-ada--pointing')
})

test('the bubble types its text with blips, and screen readers get it whole', () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const blip = vi.spyOn(sound, 'blip')
  render(<AdaBubble text="Who should the AI be?" />)
  expect(screen.getByText('Who should the AI be?', { selector: '.sr-only' })).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(2000))
  expect(screen.getByText('Who should the AI be?', { selector: '[aria-hidden="true"]' })).toBeInTheDocument()
  expect(blip).toHaveBeenCalled()
  blip.mockRestore()
})

test('with reduced motion the whole text shows at once', () => {
  resetAppStore({ reducedMotion: true })
  render(<AdaBubble text="Hello there." />)
  expect(screen.getByText('Hello there.', { selector: '[aria-hidden="true"]' })).toBeInTheDocument()
})

test('Escape and the close button dismiss the bubble; actions are shown', async () => {
  resetAppStore({ reducedMotion: true })
  const onDismiss = vi.fn()
  render(<AdaBubble text="Hello." onDismiss={onDismiss} actions={<button type="button">Edit my prompt</button>} />)
  expect(screen.getByRole('button', { name: 'Edit my prompt' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onDismiss).toHaveBeenCalledTimes(2)
})

test('without text only Ada is shown', () => {
  const { container } = render(<AdaBubble text={null} />)
  expect(container.querySelector('.ws-bubble')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
})
