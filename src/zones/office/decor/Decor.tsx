import { useQualitySettings } from '../../../app/quality'
import { useApp } from '../../../core/store'
import { AssetBoundary } from '../../../three/AssetBoundary'
import { Books } from '../../../three/Books'
import { SceneObject } from '../../../three/objects'
import { HangingPlant } from '../../../three/plants/HangingPlant'
import { Plant } from '../../../three/plants/Plant'
import { layout } from '../layout'
import { LargePlants } from './LargePlants'
import { Pendants } from './Pendants'
import { PictureFrames } from './PictureFrames'
import { Vases } from './Vases'

/**
 * The decor stage (spec section 7): everything that loads after the first image, each model left out on its own if it
 * fails (AssetBoundary). The generated plants and the books need no download. Plants sway on the high and medium tiers,
 * never with reduced motion.
 */
export function Decor() {
  const settings = useQualitySettings()
  const reducedMotion = useApp((s) => s.reducedMotion)
  const animate = settings.animatePlants && !reducedMotion
  const { cabinet, coffeeTable, plants, hangingPlants, shelfBooks } = layout.objects
  return (
    <>
      <AssetBoundary name="cabinet"><SceneObject object="cabinet" name="cabinet" position={cabinet.position} rotation-y={cabinet.rotationY} /></AssetBoundary>
      <AssetBoundary name="coffeeTable"><SceneObject object="coffeeTable" name="coffeeTable" position={coffeeTable.position} rotation-y={coffeeTable.rotationY} /></AssetBoundary>
      <AssetBoundary name="pendants"><Pendants /></AssetBoundary>
      <AssetBoundary name="frames"><PictureFrames /></AssetBoundary>
      {/* Each plant and each vase has its own boundary inside these two. */}
      <LargePlants animate={animate} />
      <Vases animate={animate} />
      {plants.map((placement, index) => <Plant key={index} name={`plant-${index}`} placement={placement} animate={animate} />)}
      {hangingPlants.map((placement, index) => <HangingPlant key={index} name={`hangingPlant-${index}`} placement={placement} animate={animate} />)}
      {shelfBooks.map((spec, index) => <Books key={index} name={`books-${index}`} spec={spec} />)}
    </>
  )
}
