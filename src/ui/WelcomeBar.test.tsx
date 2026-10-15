import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { MISSION_IDS } from '../test/workshopStore'
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

test('the workshop button shows the missions passed', () => {
  render(<WelcomeBar />)
  expect(screen.getByRole('button', { name: 'Prompt workshop' })).toBeInTheDocument()
  act(() => appStore.getState().passWorkshopMission('delayed-website', 'Prompt', MISSION_IDS))
  expect(screen.getByRole('button', { name: 'Prompt workshop · 1/6' })).toBeInTheDocument()
})

// Spec 4.6: a mission removed or renamed since leaves its id in the saved progress; it is not counted.
test('the workshop button counts only the missions that exist', () => {
  const progress = appStore.getState().progress
  appStore.setState({ progress: { ...progress, workshop: { passed: ['retired-mission'], prompts: { 'retired-mission': 'Old' } } } })
  render(<WelcomeBar />)
  expect(screen.getByRole('button', { name: 'Prompt workshop' })).toBeInTheDocument()
  act(() => appStore.getState().passWorkshopMission('delayed-website', 'Prompt', MISSION_IDS))
  expect(screen.getByRole('button', { name: 'Prompt workshop · 1/6' })).toBeInTheDocument()
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

test("Ada's debrief lists the missed topics; a topic button opens it and ends the debrief", async () => {
  appStore.getState().setDungeonDebrief({ topics: ['tokens', 'hallucinations'] })
  render(<WelcomeBar />)
  expect(screen.getByText('The guardians caught you on Tokens and Why AI makes things up. Want to review them?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tokens' }))
  expect(appStore.getState().activeTopic).toBe('tokens')
  expect(appStore.getState().dungeonDebrief).toBeNull()
})

test('Not now ends the debrief; a passed dungeon shows on its button', async () => {
  appStore.getState().passDungeonFloor(1, 90, '2026-10-15')
  appStore.getState().setDungeonDebrief({ topics: ['tokens'] })
  render(<WelcomeBar />)
  await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
  expect(appStore.getState().dungeonDebrief).toBeNull()
  expect(screen.getByRole('button', { name: 'The dungeon · passed' })).toBeInTheDocument()
  expect(screen.getByText(/Welcome to the office/)).toBeInTheDocument()
})
