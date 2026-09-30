import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { DialogueBox } from './DialogueBox'

const topic = getContent('en').topicById.get('what-is-ai')!
const lineButton = () => screen.getByRole('button', { name: 'Click or press Space to continue' })

function open() {
  act(() => appStore.getState().openTopic('what-is-ai'))
}

function toChoices() {
  act(() => {
    for (let i = 0; i < 40 && appStore.getState().dialogue?.phase !== 'choices'; i++) {
      appStore.getState().advanceDialogue()
    }
  })
}

beforeEach(() => resetAppStore())
afterEach(() => vi.useRealTimers())

test('types the line, reveals it on click, then advances', async () => {
  // shouldAdvanceTime: Testing Library's asyncWrapper awaits a setTimeout(0) that it only flushes under a global `jest`.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  open()
  render(<DialogueBox />)
  act(() => {
    vi.advanceTimersByTime(200)
  })
  const partial = screen.getByTestId('dialogue-line').textContent ?? ''
  expect(partial.length).toBeGreaterThan(0)
  expect(partial.length).toBeLessThan(topic.basics[0].say.length)
  await user.click(lineButton())
  expect(screen.getByTestId('dialogue-line')).toHaveTextContent(topic.basics[0].say)
  await user.click(lineButton())
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 1, phase: 'typing' })
})

test('exposes the full line to screen readers', () => {
  open()
  render(<DialogueBox />)
  expect(screen.getByText(topic.basics[0].say, { selector: '.sr-only' })).toHaveAttribute('aria-live', 'polite')
})

// Review focus 3: one key press, one action.
test('Space on the focused line advances exactly once', async () => {
  const user = userEvent.setup()
  open()
  act(() => appStore.getState().finishTyping())
  render(<DialogueBox />)
  lineButton().focus()
  await user.keyboard(' ')
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 1, phase: 'typing' })
})

test('Space with focus elsewhere uses the global shortcut', async () => {
  const user = userEvent.setup()
  open()
  render(<DialogueBox />)
  ;(document.activeElement as HTMLElement | null)?.blur()
  await user.keyboard(' ')
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 0, phase: 'waiting' })
})

test('Enter on a focused choice triggers only that choice', async () => {
  const user = userEvent.setup()
  open()
  toChoices()
  render(<DialogueBox />)
  screen.getByRole('button', { name: 'Go deeper' }).focus()
  await user.keyboard('{Enter}')
  expect(appStore.getState().dialogue).toMatchObject({ section: 'deeper', beatIndex: 0, phase: 'typing' })
})

test('shows the takeaway and the choices at the end of the basics', () => {
  open()
  toChoices()
  render(<DialogueBox />)
  expect(screen.getByText(topic.takeaway)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Go deeper' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'All topics' })).toBeInTheDocument()
  expect(appStore.getState().progress.topicsSeen).toContain('what-is-ai')
})

test('Escape closes the topic and reopens the menu', async () => {
  const user = userEvent.setup()
  open()
  render(<DialogueBox />)
  await user.keyboard('{Escape}')
  expect(appStore.getState()).toMatchObject({ activeTopic: null, menuOpen: true })
})

test('keys are ignored while the expanded view is open', async () => {
  const user = userEvent.setup()
  open()
  act(() => appStore.getState().setExpandOpen(true))
  render(<DialogueBox />)
  ;(document.activeElement as HTMLElement | null)?.blur()
  await user.keyboard(' ')
  expect(appStore.getState().dialogue?.phase).toBe('typing')
})

test('reduced motion shows the whole line at once', () => {
  resetAppStore({ reducedMotion: true })
  open()
  render(<DialogueBox />)
  expect(appStore.getState().dialogue?.phase).toBe('waiting')
  expect(screen.getByTestId('dialogue-line')).toHaveTextContent(topic.basics[0].say)
})
