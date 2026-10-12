import { swayRotation, swayX, swayZ } from './sway'

// The formula of Horn.os, at literal values: a roll z = A sin(0.7 t + phase) and a pitch x = 0.6 A cos(0.53 t + phase).
test('the sway formula at known points', () => {
  // At rest time and phase 0: no roll, the whole pitch (0.6 of the amplitude).
  expect(swayZ(0, 0.02, 0)).toBe(0)
  expect(swayX(0, 0.02, 0)).toBeCloseTo(0.012, 12)
  // t = 10 s, phase 1: z = 0.02 sin(8), x = 0.012 cos(6.3).
  expect(swayZ(10, 0.02, 1)).toBeCloseTo(0.019787164932, 11)
  expect(swayX(10, 0.02, 1)).toBeCloseTo(0.011998303637, 11)
  // A quarter of the roll's period (t = pi / 1.4 s, 0.7 t = pi / 2): the full amplitude; the pitch, 0.006 cos(1.1893).
  const quarter = Math.PI / 1.4
  expect(swayZ(quarter, 0.01, 0)).toBeCloseTo(0.01, 12)
  expect(swayX(quarter, 0.01, 0)).toBeCloseTo(0.002233761950, 11)
  // swayRotation hands out the same two angles.
  expect(swayRotation(10, 0.02, 1)).toEqual({ z: swayZ(10, 0.02, 1), x: swayX(10, 0.02, 1) })
})

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

// useSway reads the two angles as plain numbers, so a frame allocates nothing (Task 13 review).
test('the two sway angles are swayRotation, one number at a time', () => {
  for (const [t, amplitude, phase] of [
    [0, 0.02, 1.3],
    [3.7, 0.01, 4.7],
    [42, 0.03, 11],
    [5, 0, 2],
  ]) {
    const { x, z } = swayRotation(t, amplitude, phase)
    expect(swayX(t, amplitude, phase)).toBe(x)
    expect(swayZ(t, amplitude, phase)).toBe(z)
  }
})

test('no amplitude, no sway', () => {
  for (const t of [0, 1.3, 42]) {
    const { x, z } = swayRotation(t, 0, 5)
    expect(Math.abs(x) + Math.abs(z)).toBe(0)
  }
})
