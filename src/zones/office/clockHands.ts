/*
 * The hands of the wall_clock model (its case is in clockCase.ts). Angles are radians clockwise from 12 o'clock, seen
 * from the front of the dial (+z); the dial lies in the model's XY plane with the hands' axis at the origin, so a hand
 * turns with its node's rotation.z.
 */

/**
 * Where the second hand is parked: 20 s, 120 degrees. The clock shows 14:00, 19:30 and 23:00, and the second hand does
 * not run; on 12 it covered the minute hand at 14:00 and at 23:00. At 120 degrees it is at least 60 degrees from the hour
 * and the minute hands at all three times.
 */
export const SECOND_HAND_REST = (20 * Math.PI) / 30

/** Rest angle of a hand: the direction of its vertex farthest from the axis (its tip), atan2(x, y). */
export function handRestAngle(positions: ArrayLike<number>, itemSize = 3): number {
  let farthest = -1
  let angle = 0
  for (let i = 0; i + 1 < positions.length; i += itemSize) {
    const x = positions[i]
    const y = positions[i + 1]
    const distance = x * x + y * y
    if (distance > farthest) {
      farthest = distance
      angle = Math.atan2(x, y)
    }
  }
  return angle
}

/** Hand angles for a time of day in minutes after midnight. The second hand is parked at SECOND_HAND_REST. */
export function handAngles(minutes: number): { hour: number; minute: number; second: number } {
  return { hour: ((minutes / 60) % 12) * (Math.PI / 6), minute: (minutes % 60) * (Math.PI / 30), second: SECOND_HAND_REST }
}

/** rotation.z that turns a hand from its rest angle to `target`: clockwise seen from +z is a negative z rotation. */
export function handRotationZ(target: number, rest: number): number {
  return -(target - rest)
}
