import { AssetBoundary } from '../../../three/AssetBoundary'
import { SceneObject } from '../../../three/objects'
import { layout } from '../layout'
import { Pendants } from './Pendants'
import { PictureFrames } from './PictureFrames'

/** The decor stage: loaded after the first image, each item left out on its own if it fails (AssetBoundary). */
export function Decor() {
  const { cabinet, coffeeTable } = layout.objects
  return (
    <>
      <AssetBoundary name="cabinet"><SceneObject object="cabinet" name="cabinet" position={cabinet.position} rotation-y={cabinet.rotationY} /></AssetBoundary>
      <AssetBoundary name="coffeeTable"><SceneObject object="coffeeTable" name="coffeeTable" position={coffeeTable.position} rotation-y={coffeeTable.rotationY} /></AssetBoundary>
      <AssetBoundary name="pendants"><Pendants /></AssetBoundary>
      <AssetBoundary name="frames"><PictureFrames /></AssetBoundary>
    </>
  )
}
