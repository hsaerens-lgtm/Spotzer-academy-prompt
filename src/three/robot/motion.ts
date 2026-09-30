import type { Gesture } from '../../content/schema'

export interface GesturePose {
  bodyYaw: number
  spin: number
  armPX: number
  armNX: number
  headTilt: number
  headNod: number
  bob: number
}

export const NEUTRAL_POSE: GesturePose = { bodyYaw: 0, spin: 0, armPX: 0, armNX: 0, headTilt: 0, headNod: 0, bob: 0 }

export const GESTURE_SECONDS: Record<Gesture, number> = {
  none: 0,
  wave: 1.6,
  pointScreen: 2.4,
  spin: 1.2,
  nod: 0.9,
  shrug: 1.0,
}

/** Extra body turn toward the wall screen while pointing (the screen is on Ada's +x side). */
export const POINT_YAW = 0.9
export const BLINK_SECONDS = 0.12

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function gesturePose(gesture: Gesture, elapsed: number): GesturePose {
  const duration = GESTURE_SECONDS[gesture]
  if (duration === 0 || elapsed <= 0 || elapsed >= duration) return NEUTRAL_POSE
  const p = elapsed / duration
  const envelope = Math.sin(Math.PI * p)
  switch (gesture) {
    case 'wave':
      return { ...NEUTRAL_POSE, armNX: envelope * 2.2 + Math.sin(elapsed * 14) * 0.3 * envelope, headTilt: envelope * 0.15 }
    case 'pointScreen':
      return { ...NEUTRAL_POSE, bodyYaw: envelope * POINT_YAW, armPX: envelope * 1.3, headTilt: -envelope * 0.08 }
    case 'spin':
      return { ...NEUTRAL_POSE, spin: easeInOut(p) * Math.PI * 2, bob: envelope * 0.08 }
    case 'nod':
      return { ...NEUTRAL_POSE, headNod: Math.sin(p * Math.PI * 2) * 0.18 }
    case 'shrug':
      return { ...NEUTRAL_POSE, armPX: envelope * 0.9, armNX: envelope * 0.9, headTilt: envelope * 0.12 }
    default:
      return NEUTRAL_POSE
  }
}

export const hoverY = (time: number) => Math.sin(time * 1.4) * 0.035

export const nextBlinkDelay = (rand: () => number) => 3 + rand() * 3
