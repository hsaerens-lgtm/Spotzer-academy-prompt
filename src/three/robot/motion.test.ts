import { GESTURES } from '../../content/schema'
import { GESTURE_SECONDS, NEUTRAL_POSE, POINT_YAW, gesturePose, hoverY, nextBlinkDelay } from './motion'

test.each(GESTURES)('%s starts and ends in the neutral pose', (gesture) => {
  expect(gesturePose(gesture, 0)).toEqual(NEUTRAL_POSE)
  expect(gesturePose(gesture, GESTURE_SECONDS[gesture] + 0.01)).toEqual(NEUTRAL_POSE)
})

test('pointing turns toward the screen and raises the screen-side arm', () => {
  const pose = gesturePose('pointScreen', GESTURE_SECONDS.pointScreen / 2)
  expect(pose.bodyYaw).toBeCloseTo(POINT_YAW)
  expect(pose.armPX).toBeCloseTo(1.3)
  expect(pose.armNX).toBe(0)
})

test('waving raises the outer arm, nodding tips the head forward', () => {
  expect(gesturePose('wave', GESTURE_SECONDS.wave / 2).armNX).toBeGreaterThan(1.5)
  expect(gesturePose('nod', GESTURE_SECONDS.nod / 4).headNod).toBeGreaterThan(0.1)
})

test('a spin makes one full turn', () => {
  expect(gesturePose('spin', GESTURE_SECONDS.spin * 0.999).spin).toBeCloseTo(Math.PI * 2, 1)
})

test('hovering stays within 4 cm and blinks every 3 to 6 seconds', () => {
  for (let t = 0; t < 10; t += 0.37) expect(Math.abs(hoverY(t))).toBeLessThanOrEqual(0.035)
  expect(nextBlinkDelay(() => 0)).toBe(3)
  expect(nextBlinkDelay(() => 0.999)).toBeCloseTo(6, 1)
})
