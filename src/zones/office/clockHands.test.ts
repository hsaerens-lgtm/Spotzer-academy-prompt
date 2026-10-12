import { Vector3 } from 'three'
import { CLOCK_MINUTES } from '../../core/phase'
import { handAngles, handRestAngle, handRotationZ } from './clockHands'

test('the hands show 14:00, 19:30 and 23:00', () => {
  const day = handAngles(CLOCK_MINUTES.day)
  expect(day.hour).toBeCloseTo(Math.PI / 3)
  expect(day.minute).toBeCloseTo(0)
  const sunset = handAngles(CLOCK_MINUTES.sunset)
  expect(sunset.hour).toBeCloseTo(1.25 * Math.PI)
  expect(sunset.minute).toBeCloseTo(Math.PI)
  const night = handAngles(CLOCK_MINUTES.night)
  expect(night.hour).toBeCloseTo((11 * Math.PI) / 6)
  expect(night.minute).toBeCloseTo(0)
  expect([day.second, sunset.second, night.second]).toEqual([0, 0, 0])
  // Halfway from night to day the clock passes 03:30 (clockMinutes 210): hour hand past 3, minute hand on 6.
  expect(handAngles(210).hour).toBeCloseTo(3.5 * (Math.PI / 6))
  expect(handAngles(210).minute).toBeCloseTo(Math.PI)
})

test("the rest angle is read from the hand's farthest vertex", () => {
  // A hand pointing at 3 o'clock, its counterweight short of the axis on the other side.
  const threeOClock = [0, 0, 0.002, 0.11, 0.004, 0.002, 0.12, 0, 0.002, -0.03, 0, 0.002]
  expect(handRestAngle(threeOClock)).toBeCloseTo(Math.PI / 2)
  expect(handRestAngle([0, 0.02, 0, 0, 0.14, 0, 0.003, 0.1, 0])).toBeCloseTo(0)
  expect(handRestAngle([0, -0.13, 0, 0.01, 0.02, 0])).toBeCloseTo(Math.PI)
  // Interleaved or 4-wide data: itemSize steps over the extra values.
  expect(handRestAngle([0.12, 0, 0, 9, -0.05, 0, 0, 9], 4)).toBeCloseTo(Math.PI / 2)
})

test('positive angles turn the hands clockwise', () => {
  const z = new Vector3(0, 0, 1)
  // From 12 to 3 o'clock: the tip goes from +y to +x seen from the front.
  const tip = new Vector3(0, 0.14, 0).applyAxisAngle(z, handRotationZ(Math.PI / 2, 0))
  expect(tip.x).toBeCloseTo(0.14)
  expect(tip.y).toBeCloseTo(0)
  // A hand modelled at 3 o'clock, sent to 6 o'clock.
  const modelled = new Vector3(0.12, 0, 0).applyAxisAngle(z, handRotationZ(Math.PI, Math.PI / 2))
  expect(modelled.x).toBeCloseTo(0)
  expect(modelled.y).toBeCloseTo(-0.12)
  expect(handRotationZ(1, 1)).toBeCloseTo(0)
})
