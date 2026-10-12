import { useSoftwareRenderer } from '../../app/quality'
import { SceneObject } from '../../three/objects'
import { layout } from './layout'

/**
 * The sideboard under the wall screen: two modern_wooden_cabinet models (2.44 m each, at local x +/-1.22) and the
 * table lamp on the right one, its walnut foot on the cabinets' top (0.68 m).
 * Without a GPU (the e2e browser) both stay hidden, like the park (quality.ts): at SOFTWARE_DPR the cabinets' slatted
 * doors are some 31 000 sub-pixel triangles, shaded on both faces (the model is double-sided), about half of a software
 * frame, and no journey looks at them. The lamp goes with them rather than float.
 */
export function SideboardSet() {
  const software = useSoftwareRenderer()
  const { sideboard, lamp } = layout.objects
  return (
    <>
      <group name="sideboard" position={sideboard.position} visible={!software}>
        <SceneObject object="sideboard" position={[-1.22, 0, 0]} />
        <SceneObject object="sideboard" position={[1.22, 0, 0]} />
      </group>
      <SceneObject object="lamp" name="lamp" position={lamp.position} visible={!software} />
    </>
  )
}
