import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { App } from './App'
import { detectWebGL2 } from './webgl'

beforeEach(() => resetAppStore({ webgl: 'unavailable' }))

// Lazy zones suspend on use(): the render must be awaited inside act() for React 19 to resolve them.
async function renderApp() {
  await act(async () => {
    render(<App />)
  })
}

test('shows the workshop placeholder and returns to the office', async () => {
  appStore.setState({ zone: 'workshop' })
  await renderApp()
  expect(await screen.findByRole('heading', { name: 'Prompt Workshop' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Back to the office/ }))
  await waitFor(() => expect(appStore.getState().zone).toBe('office'), { timeout: 2000 })
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
