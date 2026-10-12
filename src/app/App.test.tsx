import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { resetWorkshopStore } from '../zones/workshop/instance'
import { App } from './App'
import { detectWebGL2 } from './webgl'
import { loadZone } from './zones'

beforeEach(() => {
  resetAppStore({ webgl: 'unavailable' })
  resetWorkshopStore()
})

// Lazy zones suspend on use(): the render must be awaited inside act() for React 19 to resolve them.
async function renderApp() {
  await act(async () => {
    render(<App />)
  })
}

test('shows the workshop and returns to the office', async () => {
  appStore.setState({ zone: 'workshop' })
  // The workshop is a lazy zone: its first import loads the whole workshop (0.5 s on an idle machine), more than
  // findByRole's 1 s when the test files run in parallel. Wait for the import itself, then for the window.
  await loadZone('workshop')
  await renderApp()
  expect(await screen.findByRole('region', { name: 'MISSIONS.EXE' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Back to the office' }))
  await waitFor(() => expect(appStore.getState().zone).toBe('office'), { timeout: 2000 })
})

// The office's window-level Escape handlers (dialogue, topic menu, expanded view) are not mounted in the workshop:
// Escape there only closes Ada's bubble, even with a topic still open behind it.
test('Escape in the workshop closes Ada\'s bubble and leaves the office dialogue alone', async () => {
  const topic = getContent('en').topics[0].id
  appStore.getState().openTopic(topic)
  appStore.setState({ zone: 'workshop' })
  await renderApp()
  const ada = within(await screen.findByRole('complementary', { name: 'Ada' }))
  expect(ada.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(ada.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  expect(appStore.getState()).toMatchObject({ zone: 'workshop', activeTopic: topic, menuOpen: false, transition: null })
})

test('shows the dungeon placeholder', async () => {
  appStore.setState({ zone: 'dungeon' })
  await renderApp()
  expect(await screen.findByRole('heading', { name: 'The Dungeon' })).toBeInTheDocument()
  expect(screen.getByText('Coming soon')).toHaveClass('at-script')
})

test('does not mount the 3D stage without WebGL', () => {
  render(<App />)
  expect(screen.queryByTestId('stage')).not.toBeInTheDocument()
})

test('detectWebGL2 reflects canvas support', () => {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
  spy.mockReturnValue(null)
  expect(detectWebGL2()).toBe(false)
  spy.mockReturnValue({} as RenderingContext)
  expect(detectWebGL2()).toBe(true)
  spy.mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(detectWebGL2()).toBe(false)
  spy.mockRestore()
})
