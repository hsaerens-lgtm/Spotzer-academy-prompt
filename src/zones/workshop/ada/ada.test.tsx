import { Profiler } from 'react'
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

test('a new line types from nothing: the old line never reveals its first characters', () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const typed = (): string => document.querySelector('.ws-bubble__text [aria-hidden="true"]')?.textContent ?? ''
  const commits: string[] = []
  // onRender runs once per commit, after the DOM is updated: the first commit of the new line is the one that could flash.
  const bubble = (text: string) => (
    <Profiler id="bubble" onRender={() => commits.push(typed())}>
      <AdaBubble text={text} />
    </Profiler>
  )
  const { rerender } = render(bubble('The first line is long.'))
  act(() => vi.advanceTimersByTime(2000))
  expect(typed()).toBe('The first line is long.')
  commits.length = 0
  rerender(bubble('Then a second line.'))
  expect(commits[0]).toBe('')
  expect(screen.getByText('Then a second line.', { selector: '.sr-only' })).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(2000))
  expect(typed()).toBe('Then a second line.')
})

// Ada has her own row in the desktop grid: a bubble growing line by line would push the windows above it mid-sentence.
test('while the line types, the rest of it already holds its place, hidden', () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const text = 'Who should the AI be?'
  render(<AdaBubble text={text} />)
  const typed = () => document.querySelector('.ws-bubble__text [aria-hidden="true"]')!.textContent
  const rest = () => document.querySelector('.ws-bubble__untyped')
  expect(rest()).toHaveTextContent(text)
  act(() => vi.advanceTimersByTime(200))
  expect(typed()!.length).toBeGreaterThan(0)
  expect(`${typed()}${rest()!.textContent}`).toBe(text)
  expect(rest()).toHaveAttribute('aria-hidden', 'true')
  act(() => vi.advanceTimersByTime(2000))
  expect(typed()).toBe(text)
  expect(rest()).toBeNull()
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
