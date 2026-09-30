import { ContactShadows } from '@react-three/drei'
import { brand } from '../../core/brand'
import { Interactive } from '../../three/interactive'
import { SceneObject } from '../../three/objects'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { objectActions } from './interactions'
import { layout } from './layout'
import { Lights } from './Lights'
import { Room } from './Room'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const { table, chairs, microphones, sideboard, lamp, laptop, cabinet, tv, retroConsole, sofa, logo } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <CameraRig />
      <Lights />
      <Room />
      <SceneObject object="table" name="table" position={table.position} />
      {chairs.map((chair, index) => (
        <SceneObject key={index} object="chair" name={`chair-${index}`} position={chair.position} rotation-y={chair.rotationY} />
      ))}
      {microphones.map((mic, index) => (
        <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
      ))}
      <SceneObject object="sideboard" name="sideboard" position={sideboard.position} />
      <SceneObject object="lamp" name="lamp" position={lamp.position} />
      <Interactive id="laptop" onActivate={objectActions.laptop}>
        <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      </Interactive>
      <SceneObject object="cabinet" name="cabinet" position={cabinet.position} rotation-y={cabinet.rotationY} />
      <Interactive id="tv" onActivate={objectActions.tv}>
        <SceneObject object="crtTv" name="tv" position={tv.position} rotation-y={tv.rotationY} />
        <CrtScreen />
        <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      </Interactive>
      <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
      <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
      <WallScreen3D />
      <ContactShadows
        position={[table.position[0], 0.006, table.position[2]]}
        scale={[5, 7.5]}
        opacity={0.55}
        blur={2.4}
        far={1.4}
        resolution={512}
        frames={1}
      />
    </>
  )
}
