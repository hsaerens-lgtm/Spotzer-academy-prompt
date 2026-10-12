import { useRef } from 'react'
import type { Group } from 'three'
import { useQualitySettings } from '../../app/quality'
import { SceneReadySignal } from '../../app/SceneReadySignal'
import { brand } from '../../core/brand'
import { useApp } from '../../core/store'
import { Interactive } from '../../three/interactive'
import { useMaterials } from '../../three/materials'
import { SceneObject } from '../../three/objects'
import { ChairSet } from '../../three/props/ChairSet'
import { AdaController } from './AdaController'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { Decor } from './decor/Decor'
import { DecorStage } from './decor/DecorStage'
import { FloorContactShadow } from './FloorContactShadow'
import { objectActions } from './interactions'
import { layout } from './layout'
import { useEmissiveLevels } from './lighting/emissive'
import { Lights } from './lighting/Lights'
import { OfficeEnvironment } from './lighting/OfficeEnvironment'
import { PhaseDriver } from './lighting/PhaseDriver'
import { PRESETS } from './lighting/presets'
import { OUTDOOR } from './outdoor/cityPlan'
import { Outdoor } from './outdoor/Outdoor'
import { Room } from './Room'
import { SideboardSet } from './SideboardSet'
import { WallClock } from './WallClock'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const settings = useQualitySettings()
  const materials = useMaterials()
  useEmissiveLevels(materials)
  const sceneReady = useApp((s) => s.sceneReady)
  const base = useRef<Group>(null)
  const { table, chairs, microphones, laptop, tvStand, tv, retroConsole, sofa, floorLamp, logo, shelves } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
      <CameraRig />
      <OfficeEnvironment />
      <PhaseDriver />
      <Lights settings={settings} />
      <group name="base" ref={base}>
        <Outdoor />
        <Room />
        <SceneObject object="table" name="table" position={table.position} />
        <ChairSet placements={chairs} />
        {microphones.map((mic, index) => (
          <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
        ))}
        <SideboardSet />
        <Interactive id="laptop" onActivate={objectActions.laptop}>
          <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
        </Interactive>
        <SceneObject object="tvStand" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
        <Interactive id="tv" onActivate={objectActions.tv}>
          <SceneObject object="crtTv" name="tv" outline position={tv.position} rotation-y={tv.rotationY} />
          <CrtScreen />
          <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
        </Interactive>
        <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
        <SceneObject object="floorLamp" name="floorLamp" position={floorLamp.position} rotation-y={floorLamp.rotationY} />
        <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
        <SceneObject object="shelves" name="shelves" position={shelves.position} rotation-y={shelves.rotationY} />
        <WallClock />
        <WallScreen3D />
        <AdaController />
      </group>
      <FloorContactShadow />
      <SceneReadySignal target={base} />
      {sceneReady && (
        <DecorStage>
          <Decor />
        </DecorStage>
      )}
    </>
  )
}
