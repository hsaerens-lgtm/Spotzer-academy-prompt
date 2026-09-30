import { act, render, screen } from '@testing-library/react'
import { SmallScreenNotice } from './SmallScreenNotice'

function resize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

test('warns below 1280 × 720 and hides again on a large window', () => {
  resize(1000, 700)
  render(<SmallScreenNotice />)
  expect(screen.getByRole('status')).toHaveTextContent('This experience works best on a larger screen.')
  act(() => resize(1600, 900))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
