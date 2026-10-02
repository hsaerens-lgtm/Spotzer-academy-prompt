import { render } from '@testing-library/react'
import { brand } from '../core/brand'
import { Logo } from './Logo'

test('paints the mark with the brand constants and keeps the dark squares on currentColor', () => {
  const { container } = render(<Logo />)
  const fills = Array.from(container.querySelectorAll('rect'), (rect) => rect.getAttribute('fill'))
  expect(fills).toEqual([brand.mint, 'currentColor', 'currentColor', brand.lime, brand.lime])
})

test('is decorative without a title and labelled with one', () => {
  const { container, rerender } = render(<Logo />)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  rerender(<Logo title="Online Essentials" />)
  expect(container.querySelector('svg')).toHaveAttribute('role', 'img')
  expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'Online Essentials')
})
