import { onContextLost } from './webgl'

// A context loss is only reported when the canvas is still on the page: R3F force-loses the context of a
// canvas it unmounts on purpose (reading mode, zone change), which must not look like a device failure.
test('reports a context loss on a connected canvas and prevents the default restore behavior', () => {
  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  const report = vi.fn()
  const event = new Event('webglcontextlost', { cancelable: true })
  onContextLost(canvas, report)(event)
  expect(report).toHaveBeenCalledTimes(1)
  expect(event.defaultPrevented).toBe(true)
  canvas.remove()
})

test('ignores a context loss on a detached canvas', () => {
  const canvas = document.createElement('canvas')
  const report = vi.fn()
  const event = new Event('webglcontextlost', { cancelable: true })
  onContextLost(canvas, report)(event)
  expect(report).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(true)
})

test('works as a real webglcontextlost listener', () => {
  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  const report = vi.fn()
  canvas.addEventListener('webglcontextlost', onContextLost(canvas, report), { once: true })
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(report).toHaveBeenCalledTimes(1)
  canvas.remove()
})
