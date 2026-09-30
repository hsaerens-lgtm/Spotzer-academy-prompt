import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
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
