import { ContactShadows } from '@react-three/drei'
import { useQualitySettings } from '../../app/quality'
import { brand } from '../../core/brand'
import { Interactive } from '../../three/interactive'
import { useMaterials } from '../../three/materials'
import { SceneObject } from '../../three/objects'
import { ChairSet } from '../../three/props/ChairSet'
import { AdaController } from './AdaController'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { objectActions } from './interactions'
import { CONTACT_SHADOW_Y, layout } from './layout'
import { useEmissiveLevels } from './lighting/emissive'
import { Lights } from './lighting/Lights'
import { OfficeEnvironment } from './lighting/OfficeEnvironment'
import { PhaseDriver } from './lighting/PhaseDriver'
import { PRESETS } from './lighting/presets'
import { OUTDOOR } from './outdoor/cityPlan'
import { Outdoor } from './outdoor/Outdoor'
import { Room } from './Room'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const settings = useQualitySettings()
  const materials = useMaterials()
  useEmissiveLevels(materials)
  const { table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, floorLamp, logo, shelves } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
      <CameraRig />
      <OfficeEnvironment />
      <PhaseDriver />
      <Lights settings={settings} />
      <Outdoor />
      <Room />
      <SceneObject object="table" name="table" position={table.position} />
      <ChairSet placements={chairs} />
      {microphones.map((mic, index) => (
        <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
      ))}
      <SceneObject object="sideboard" name="sideboard" position={sideboard.position} />
      <SceneObject object="lamp" name="lamp" position={lamp.position} />
      <Interactive id="laptop" onActivate={objectActions.laptop}>
        <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      </Interactive>
      <SceneObject object="tvStand" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
      <Interactive id="tv" onActivate={objectActions.tv}>
        <SceneObject object="crtTv" name="tv" position={tv.position} rotation-y={tv.rotationY} />
        <CrtScreen />
        <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      </Interactive>
      <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
      <SceneObject object="floorLamp" name="floorLamp" position={floorLamp.position} rotation-y={floorLamp.rotationY} />
      <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
      <SceneObject object="shelves" name="shelves" position={shelves.position} rotation-y={shelves.rotationY} />
      <WallScreen3D />
      <AdaController />
      <ContactShadows position={[layout.ada.position[0], CONTACT_SHADOW_Y, layout.ada.position[2]]} scale={1.4} opacity={0.35} blur={2.5} far={1.6} resolution={256} frames={1} />
      <ContactShadows position={[table.position[0], CONTACT_SHADOW_Y, table.position[2]]} scale={[5, 7.5]} opacity={0.55} blur={2.4} far={1.4} resolution={512} frames={1} />
    </>
  )
}
