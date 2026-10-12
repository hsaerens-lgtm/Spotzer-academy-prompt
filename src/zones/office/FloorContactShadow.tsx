import { ContactShadows } from '@react-three/drei'
import { useApp } from '../../core/store'
import { CONTACT_SHADOW_Y, ROOM } from './layout'

/**
 * The contact shadow of the whole floor (Task 12 ruling): one drei ContactShadows over the room (10 x 12 m, centred on
 * the world origin like the room). drei 10.7.9 blurs its shadow by drawing a plane fixed at the world origin, at y 0,
 * with the shadow camera: centred there, the blur lines up with the shadow, and a near plane 5 cm below the camera
 * (which sits at CONTACT_SHADOW_Y, 2 cm above the floor) keeps that plane in view. The camera looks up and records every
 * face that looks down, from there up to `far`: the undersides of what stands on the floor, darkest where they touch it.
 * The floor's surface looks up, out of its sight; the rug, lying on the floor, has no underside (Room.tsx).
 * Tuned on GPU shots: soft grounding under the table, chairs, sofa, cabinet and Ada, about a quarter darker under the
 * table top.
 */
export const FLOOR_SHADOW = { near: -0.05, far: 1.6, resolution: 1024, blur: 1.5, opacity: 0.45 } as const
const POSITION: [number, number, number] = [0, CONTACT_SHADOW_Y, 0]

/**
 * drei draws a frames={1} shadow once per render of its component (its frame counter is local to the render). This one
 * renders again when the base becomes ready (it was hidden while its shaders compiled) and when the decor does, so both
 * stand on the floor. Its props are constants: drei builds its render targets again whenever its size props change.
 */
export function FloorContactShadow() {
  // Read only to render again when they turn true.
  useApp((s) => s.sceneReady)
  useApp((s) => s.decorReady)
  return (
    <ContactShadows
      position={POSITION}
      scale={1}
      width={ROOM.width}
      height={ROOM.depth}
      near={FLOOR_SHADOW.near}
      far={FLOOR_SHADOW.far}
      resolution={FLOOR_SHADOW.resolution}
      blur={FLOOR_SHADOW.blur}
      opacity={FLOOR_SHADOW.opacity}
      frames={1}
    />
  )
}
