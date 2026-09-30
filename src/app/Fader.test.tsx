import { act, render, screen } from '@testing-library/react'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { FADE_MS, Fader } from './Fader'

afterEach(() => vi.useRealTimers())

test('covers the screen, switches zone after the fade, then uncovers', () => {
  vi.useFakeTimers()
  resetAppStore()
  appStore.getState().requestZone('workshop')
  render(<Fader />)
  expect(screen.getByTestId('fader')).toHaveClass('is-on')
  act(() => {
    vi.advanceTimersByTime(FADE_MS)
  })
  expect(appStore.getState().zone).toBe('workshop')
  expect(screen.getByTestId('fader')).not.toHaveClass('is-on')
})

test('does nothing during a camera flight', () => {
  vi.useFakeTimers()
  resetAppStore()
  appStore.getState().requestZone('workshop', 'laptop')
  render(<Fader />)
  expect(screen.getByTestId('fader')).not.toHaveClass('is-on')
  act(() => {
    vi.advanceTimersByTime(FADE_MS * 3)
  })
  expect(appStore.getState().transition?.stage).toBe('flight')
})
