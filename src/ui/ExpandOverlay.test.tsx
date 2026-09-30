import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { DialogueBox } from './DialogueBox'
import { ExpandOverlay } from './ExpandOverlay'

beforeEach(() => {
  resetAppStore()
  act(() => {
    appStore.getState().openTopic('what-is-ai')
    appStore.getState().setExpandOpen(true)
  })
})

test('shows the current visual with the close button focused', () => {
  render(<ExpandOverlay />)
  expect(screen.getByRole('dialog', { name: 'Expand' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  expect(document.querySelector('.vz--what-is-ai')).not.toBeNull()
})

test('closes with Escape or the close button', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<ExpandOverlay />)
  await user.keyboard('{Escape}')
  expect(appStore.getState().expandOpen).toBe(false)
  unmount()
  act(() => appStore.getState().setExpandOpen(true))
  render(<ExpandOverlay />)
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(appStore.getState().expandOpen).toBe(false)
})

// The dialogue stays mounted behind the expanded view: focus must not escape to it.
test('keeps focus inside the dialog and leaves the dialogue behind it untouched', async () => {
  const user = userEvent.setup()
  act(() => appStore.getState().finishTyping())
  render(
    <>
      <DialogueBox />
      <ExpandOverlay />
    </>,
  )
  const dialog = screen.getByRole('dialog', { name: 'Expand' })
  await user.tab()
  await user.tab()
  expect(dialog).toContainElement(document.activeElement as HTMLElement)
  await user.tab({ shift: true })
  expect(dialog).toContainElement(document.activeElement as HTMLElement)
  await user.keyboard(' ')
  expect(appStore.getState().dialogue).toMatchObject({ topicId: 'what-is-ai', beatIndex: 0, phase: 'waiting' })
  expect(dialog).toContainElement(document.activeElement as HTMLElement)
})

test('Escape closes only the expanded view, not the topic', async () => {
  const user = userEvent.setup()
  render(
    <>
      <DialogueBox />
      <ExpandOverlay />
    </>,
  )
  await user.keyboard('{Escape}')
  expect(appStore.getState()).toMatchObject({ expandOpen: false, activeTopic: 'what-is-ai' })
})
