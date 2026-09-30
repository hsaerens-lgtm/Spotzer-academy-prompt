import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { TopicMenu } from './TopicMenu'

const content = getContent('en')

beforeEach(() => resetAppStore({ menuOpen: true }))

test('lists chapters as tabs and topics as buttons', async () => {
  render(<TopicMenu />)
  const tabs = screen.getAllByRole('tab')
  expect(tabs).toHaveLength(content.chapters.length)
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(screen.getByRole('button', { name: /What is AI\?/ }))
  expect(appStore.getState().activeTopic).toBe('what-is-ai')
})

test('marks seen topics', () => {
  act(() => appStore.setState({ progress: { ...appStore.getState().progress, topicsSeen: ['what-is-ai'] } }))
  render(<TopicMenu />)
  const pill = screen.getByRole('button', { name: /What is AI\?/ })
  expect(within(pill).getByLabelText('Seen')).toBeInTheDocument()
})

test('close button and Escape close the menu', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<TopicMenu />)
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(appStore.getState().menuOpen).toBe(false)
  unmount()
  act(() => appStore.getState().openMenu())
  render(<TopicMenu />)
  await user.keyboard('{Escape}')
  expect(appStore.getState().menuOpen).toBe(false)
})

test('the embedded menu has no close button', () => {
  render(<TopicMenu embedded />)
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
})
