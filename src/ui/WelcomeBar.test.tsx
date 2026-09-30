import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { WelcomeBar } from './WelcomeBar'

beforeEach(() => resetAppStore())

test('learn opens the topic menu in the presentation view', async () => {
  render(<WelcomeBar />)
  await userEvent.click(screen.getByRole('button', { name: /Learn the basics/ }))
  expect(appStore.getState()).toMatchObject({ menuOpen: true, railTarget: 1 })
})

test('workshop and dungeon buttons fly to their objects', async () => {
  render(<WelcomeBar />)
  await userEvent.click(screen.getByRole('button', { name: 'Prompt workshop' }))
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
})

test('first-visit hints disappear once scrolled and once a topic was opened', () => {
  render(<WelcomeBar />)
  expect(screen.getByText('Scroll to take a seat')).toBeInTheDocument()
  expect(screen.getByText(/the laptop and the old console are clickable/)).toBeInTheDocument()
  act(() => appStore.getState().nudgeRail(0.1))
  expect(screen.queryByText('Scroll to take a seat')).not.toBeInTheDocument()
  act(() => appStore.getState().openTopic('what-is-ai'))
  expect(screen.queryByText(/the laptop and the old console are clickable/)).not.toBeInTheDocument()
})
