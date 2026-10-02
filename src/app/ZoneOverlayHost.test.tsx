import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { ZoneOverlayHost } from './ZoneOverlayHost'

// The workshop chunk fails on the first import and loads on the next one (a stale tab, then a fresh attempt).
const imports = vi.hoisted(() => ({ workshop: 0 }))
vi.mock('./zones', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./zones')>()
  const { createElement } = await import('react')
  return {
    ...actual,
    loadZone: actual.createZoneLoader({
      workshop: () => {
        imports.workshop += 1
        return imports.workshop === 1
          ? Promise.reject(new Error('Failed to fetch dynamically imported module'))
          : Promise.resolve({ id: 'workshop' as const, Overlay: () => createElement('p', null, 'Workshop loaded') })
      },
      dungeon: () => Promise.reject(new Error('unused')),
    }),
  }
})

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 60)))

let errorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errorSpy.mockRestore())

// Review focus 4: never a crash or a loop. A failed import is dropped from the cache, so re-asking for it on every
// Suspense retry would import again and again, and the error boundary would never be reached.
test('a failed zone import reaches the error card without retrying in a loop, and a later visit retries', async () => {
  resetAppStore({ webgl: 'unavailable', zone: 'workshop' })
  await act(async () => {
    render(<ZoneOverlayHost />)
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  await settle()
  expect(imports.workshop).toBe(1)

  // Leave the zone (the card's button starts the fade back to the office), then come back.
  await userEvent.click(screen.getByRole('button', { name: 'Back to the office' }))
  await act(async () => appStore.setState({ zone: 'office', transition: null }))
  expect(await screen.findByRole('main', { name: 'Reading mode' })).toBeInTheDocument()
  await act(async () => appStore.setState({ zone: 'workshop' }))
  expect(await screen.findByText('Workshop loaded')).toBeInTheDocument()
  expect(imports.workshop).toBe(2)
})
