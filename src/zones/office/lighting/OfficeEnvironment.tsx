import { Environment, Lightformer } from '@react-three/drei'
import { useMemo } from 'react'
import { RIG } from './rig'

/**
 * The reflections of the room, built in the scene from Lightformers (no HDR file, no CDN): the glazing, the ceiling,
 * a dim panel on the camera side so nothing facing the camera goes black, and the warm bounce of the floor
 * (Horn.os D&D environment). Captured once; only its strength changes with the phase (PhaseDriver, environment.ts).
 */
export function OfficeEnvironment() {
  // Stable children: drei captures the environment again, and resets the environment strength, whenever they change.
  const formers = useMemo(
    () =>
      RIG.environment.lightformers.map((former) => (
        <Lightformer
          key={former.name}
          form="rect"
          position={[...former.position]}
          rotation={[...former.rotation]}
          scale={[...former.scale]}
          intensity={former.intensity}
          color={former.colour}
        />
      )),
    [],
  )
  return (
    <Environment resolution={RIG.environment.resolution} frames={1}>
      {formers}
    </Environment>
  )
}
