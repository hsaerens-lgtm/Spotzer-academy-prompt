import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

let errorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errorSpy.mockRestore())

test('a crashed zone shows a recovery card that returns to the office', async () => {
  resetAppStore({ zone: 'workshop' })
  const onError = vi.fn()
  render(
    <ErrorBoundary zone="workshop" onError={onError}>
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  expect(onError).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Back to the office' }))
  expect(appStore.getState().transition?.to).toBe('office')
})

test('a crashed office falls back to reading mode', async () => {
  resetAppStore()
  render(
    <ErrorBoundary zone="office">
      <Boom />
    </ErrorBoundary>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Back to the office' }))
  expect(appStore.getState().readingMode).toBe(true)
})
