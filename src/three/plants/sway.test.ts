import { swayRotation } from './sway'

test('sway stays within its amplitude', () => {
  const amplitude = 0.01
  const zs: number[] = []
  for (let t = 0; t < 60; t += 0.37) {
    const { x, z } = swayRotation(t, amplitude, 2.1)
    expect(Math.abs(z)).toBeLessThanOrEqual(amplitude)
    expect(Math.abs(x)).toBeLessThanOrEqual(amplitude * 0.6)
    zs.push(z)
  }
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(amplitude)
  // The phase sets plants apart: two seeds never sway in step.
  expect(swayRotation(3, amplitude, 11).z).not.toBeCloseTo(swayRotation(3, amplitude, 23).z, 6)
})

test('no amplitude, no sway', () => {
  for (const t of [0, 1.3, 42]) {
    const { x, z } = swayRotation(t, 0, 5)
    expect(Math.abs(x) + Math.abs(z)).toBe(0)
  }
})
