// Ported from Horn.os (owner's project): js/scene/city.js (buildCity)
import { useThree } from '@react-three/fiber'
import { useLightingApplier } from '../lighting/live'
import { City } from './City'
import { OUTDOOR } from './cityPlan'
import { Birds, Clouds } from './Clouds'
import { Sky } from './Sky'
import { Street } from './Street'

/**
 * The view through the glazing: sky dome, clouds and birds, the city, the street eight floors down. Real geometry, so
 * the camera's moves give true parallax. Moved by OUTDOOR.originX so Horn.os' window wall lands on ours. Exempt from
 * the material audit (it is the sky, spec section 9); nothing out here casts or receives shadows. The scene fog
 * (OfficeScene) takes the horizon colour of the phase, so the distant city melts into the sky.
 */
export function Outdoor() {
  const scene = useThree((state) => state.scene)
  useLightingApplier((p) => {
    scene.fog?.color.copy(p.skyHorizon)
  })
  return (
    <group name="outdoor" position-x={OUTDOOR.originX} userData={{ auditExempt: 'sky' }}>
      <Sky />
      <Clouds />
      <Birds />
      <City />
      <Street />
    </group>
  )
}
