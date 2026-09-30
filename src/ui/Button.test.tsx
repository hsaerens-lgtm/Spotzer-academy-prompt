import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

test('renders a pill button with the variant classes', () => {
  render(<Button variant="primary" size="sm">Go</Button>)
  const button = screen.getByRole('button', { name: 'Go' })
  expect(button).toHaveClass('at-btn', 'at-btn--primary', 'at-btn--sm')
  expect(button).toHaveAttribute('type', 'button')
})

test('defaults to the ghost variant and forwards clicks', async () => {
  const onClick = vi.fn()
  render(<Button onClick={onClick}>Back</Button>)
  const button = screen.getByRole('button', { name: 'Back' })
  expect(button).toHaveClass('at-btn--ghost')
  await userEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(1)
})
