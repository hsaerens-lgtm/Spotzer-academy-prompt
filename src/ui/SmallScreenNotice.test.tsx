import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SmallScreenNotice } from './SmallScreenNotice'

/** Spec 8.6 is about the screen (the monitor), not the window: a 1280 × 720 screen has a ~1280 × 600 viewport. */
function stubScreen(width: number, height: number) {
  Object.defineProperty(window.screen, 'width', { configurable: true, value: width })
  Object.defineProperty(window.screen, 'height', { configurable: true, value: height })
}

function stubViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

afterEach(() => {
  // Own properties shadow the prototype getters: deleting them restores jsdom's defaults.
  Reflect.deleteProperty(window.screen, 'width')
  Reflect.deleteProperty(window.screen, 'height')
})

test('warns when the screen is smaller than 1280 × 720', () => {
  stubScreen(1024, 768)
  render(<SmallScreenNotice />)
  expect(screen.getByRole('status')).toHaveTextContent('This experience works best on a larger screen.')
  expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
})

test('warns when only the height is below the minimum', () => {
  stubScreen(1366, 700)
  render(<SmallScreenNotice />)
  expect(screen.getByRole('status')).toBeInTheDocument()
})

test('stays hidden on a screen of at least 1280 × 720, even if the window viewport is shorter', () => {
  stubScreen(1280, 720)
  stubViewport(1280, 600)
  render(<SmallScreenNotice />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  stubScreen(1920, 1080)
  stubViewport(900, 500)
  act(() => window.dispatchEvent(new Event('resize')))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('follows the screen when the window moves to another monitor', () => {
  stubScreen(1920, 1080)
  render(<SmallScreenNotice />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  stubScreen(1024, 768)
  act(() => window.dispatchEvent(new Event('resize')))
  expect(screen.getByRole('status')).toBeInTheDocument()
})

test('the dismiss button hides the notice for good', async () => {
  stubScreen(1024, 768)
  render(<SmallScreenNotice />)
  await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new Event('resize')))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
