// Ported from Horn.os (owner's project): js/scene/office.js (the swaying loop of the animation frame)
import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Object3D } from 'three'

/** The roll of the sway (about z), in radians: see swayRotation. */
export function swayZ(time: number, amplitude: number, phase: number): number {
  return Math.sin(time * 0.7 + phase) * amplitude
}

/** The pitch of the sway (about x), in radians: see swayRotation. */
export function swayX(time: number, amplitude: number, phase: number): number {
  return Math.cos(time * 0.53 + phase) * amplitude * 0.6
}

/**
 * A slow, uneven sway: two sines of incommensurate periods so the motion never visibly repeats. Radians, about the
 * object's origin (a pot's base, or a hanging plant's hook, where it is a pendulum).
 */
export function swayRotation(time: number, amplitude: number, phase: number): { x: number; z: number } {
  return { z: swayZ(time, amplitude, phase), x: swayX(time, amplitude, phase) }
}

/**
 * Sways `target` every frame while `enabled` (quality tier and reduced motion decide), and stands it still otherwise.
 * Only x and z rotations are written: a placement's own turn (y) is left alone. A frame allocates nothing; standing
 * still, the object is turned back once, then left alone (the low tier and reduced motion still every plant).
 */
export function useSway(target: RefObject<Object3D | null>, amplitude: number, phase: number, enabled: boolean): void {
  useFrame(({ clock }) => {
    const rotation = target.current?.rotation
    if (!rotation) return
    if (!enabled) {
      if (rotation.x !== 0 || rotation.z !== 0) rotation.set(0, rotation.y, 0)
      return
    }
    const time = clock.elapsedTime
    rotation.set(swayX(time, amplitude, phase), rotation.y, swayZ(time, amplitude, phase))
  })
}
