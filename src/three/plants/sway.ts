// Ported from Horn.os (owner's project): js/scene/office.js (the swaying loop of the animation frame)
import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Object3D } from 'three'

/**
 * A slow, uneven sway: two sines of incommensurate periods so the motion never visibly repeats. Radians, about the
 * object's origin (a pot's base, or a hanging plant's hook, where it is a pendulum).
 */
export function swayRotation(time: number, amplitude: number, phase: number): { x: number; z: number } {
  return { z: Math.sin(time * 0.7 + phase) * amplitude, x: Math.cos(time * 0.53 + phase) * amplitude * 0.6 }
}

/**
 * Sways `target` every frame while `enabled` (quality tier and reduced motion decide), and stands it still otherwise.
 * Only x and z rotations are written: a placement's own turn (y) is left alone.
 */
export function useSway(target: RefObject<Object3D | null>, amplitude: number, phase: number, enabled: boolean): void {
  useFrame(({ clock }) => {
    const object = target.current
    if (!object) return
    const { x, z } = enabled ? swayRotation(clock.elapsedTime, amplitude, phase) : { x: 0, z: 0 }
    object.rotation.x = x
    object.rotation.z = z
  })
}
