import { render, screen } from '@testing-library/react'
import { AssetBoundary } from './AssetBoundary'

function Missing(): never {
  throw new Error('Could not load assets/models/potted_plant_01.glb: 404')
}

let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  // React reports every error caught by a boundary on console.error: expected here, kept out of the test output.
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
  warnSpy.mockRestore()
})

test('renders its children', () => {
  render(
    <AssetBoundary name="frames">
      <p>poster</p>
    </AssetBoundary>,
  )
  expect(screen.getByText('poster')).toBeInTheDocument()
  expect(warnSpy).not.toHaveBeenCalled()
})

// Review focus 3: a missing decor model leaves everything else in place.
test('a failing d\u00e9cor item renders nothing and warns in development', () => {
  render(
    <div data-testid="decor">
      <AssetBoundary name="pottedPlant">
        <p>plant</p>
        <Missing />
      </AssetBoundary>
      <p>coffee table</p>
    </div>,
  )
  expect(screen.getByTestId('decor')).toHaveTextContent(/^coffee table$/)
  expect(warnSpy).toHaveBeenCalledTimes(1)
  expect(warnSpy).toHaveBeenCalledWith('Decor item "pottedPlant" failed to load and is left out.', expect.any(Error))
})

// A base object with a stand-in: the procedural laptop takes over when the laptop model cannot load.
test('a failing item with a fallback shows the fallback instead', () => {
  render(
    <AssetBoundary name="laptop" fallback={<p>procedural laptop</p>}>
      <p>model</p>
      <Missing />
    </AssetBoundary>,
  )
  expect(screen.getByText('procedural laptop')).toBeInTheDocument()
  expect(screen.queryByText('model')).toBeNull()
})

// Review focus 3: R3F reports every caught error with reportError(); the boundary cancels that report, and only that one.
test('an error it has handled is not reported as uncaught', () => {
  const error = new Error('Could not load assets/models/potted_plant_01.glb: 404')
  function Failing(): never {
    throw error
  }
  render(
    <AssetBoundary name="pottedPlant">
      <Failing />
    </AssetBoundary>,
  )
  const reported = (thrown: Error) => {
    const event = new ErrorEvent('error', { error: thrown, cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(reported(error)).toBe(true)
  expect(reported(new Error('something else'))).toBe(false)
})

// No retry: a failed item is never mounted again, so a model cannot remount in a loop (R3F 9.8.1's Portal keeps the
// store of every outlined copy it mirrored, one more per remount).
test('a failed d\u00e9cor item stays left out when its parent renders again', () => {
  let renders = 0
  function Counted(): never {
    renders += 1
    throw new Error('Could not load assets/models/drawer_cabinet.glb: 404')
  }
  const { container, rerender } = render(
    <AssetBoundary name="cabinet">
      <Counted />
    </AssetBoundary>,
  )
  const failedAfter = renders
  expect(failedAfter).toBeGreaterThan(0)
  rerender(
    <AssetBoundary name="cabinet">
      <Counted />
    </AssetBoundary>,
  )
  rerender(
    <AssetBoundary name="cabinet">
      <p>cabinet</p>
    </AssetBoundary>,
  )
  expect(renders).toBe(failedAfter)
  expect(container).toBeEmptyDOMElement()
  expect(warnSpy).toHaveBeenCalledTimes(1)
})
