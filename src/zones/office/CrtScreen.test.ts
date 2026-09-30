import { BLINK_SECONDS, blinkOn, fillNoise } from './CrtScreen'

test('PRESS START blinks on and off', () => {
  expect(blinkOn(0)).toBe(true)
  expect(blinkOn(BLINK_SECONDS + 0.01)).toBe(false)
  expect(blinkOn(BLINK_SECONDS * 2 + 0.01)).toBe(true)
})

test('noise fills opaque grey pixels', () => {
  const data = new Uint8ClampedArray(4 * 3)
  const values = [0.1, 0.5, 0.9]
  fillNoise(data, () => values.shift()!)
  expect(Array.from(data)).toEqual([26, 26, 26, 255, 128, 128, 128, 255, 230, 230, 230, 255])
})
