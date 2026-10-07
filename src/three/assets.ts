import { modelFile, textureFile, type Stage, type TextureMap } from '../assets/paths'
import { publicUrl } from '../core/publicUrl'

export type TextureSetId = 'floor' | 'wall' | 'oak' | 'walnut' | 'fabric' | 'carpet' | 'blackMetal' | 'brushedMetal'
export interface TextureSetSpec {
  /** Manifest id (scripts/assets/manifest.json). */
  assetId: string
  /** Real-world size of one texture repeat, in metres (geometry UVs are in metres, see three/uv.ts). */
  tileMetres: number
  metal: boolean
}
export const TEXTURE_SETS: Record<TextureSetId, TextureSetSpec> = {
  floor: { assetId: 'plank_flooring_04', tileMetres: 2, metal: false },
  wall: { assetId: 'beige_wall_001', tileMetres: 3, metal: false },
  oak: { assetId: 'oak_veneer_05', tileMetres: 1, metal: false },
  walnut: { assetId: 'american_walnut_veneer', tileMetres: 1, metal: false },
  fabric: { assetId: 'fabric036', tileMetres: 0.5, metal: false },
  carpet: { assetId: 'carpet016', tileMetres: 1.7, metal: false },
  blackMetal: { assetId: 'metal046a', tileMetres: 1, metal: true },
  brushedMetal: { assetId: 'metal027', tileMetres: 1, metal: true },
}
export const TEXTURE_SET_IDS = Object.keys(TEXTURE_SETS) as TextureSetId[]

export type ModelId =
  | 'sideboard' | 'television' | 'wallClock' | 'drawerCabinet' | 'coffeeTable' | 'pendantLamp'
  | 'pictureFrame' | 'pottedPlant' | 'pachira' | 'vaseTall' | 'vaseRound' | 'clayPot'
export interface ModelSpec {
  assetId: string
  stage: Stage
}
export const MODELS: Record<ModelId, ModelSpec> = {
  sideboard: { assetId: 'modern_wooden_cabinet', stage: 'base' },
  television: { assetId: 'television_02', stage: 'base' },
  wallClock: { assetId: 'wall_clock', stage: 'base' },
  drawerCabinet: { assetId: 'drawer_cabinet', stage: 'decor' },
  coffeeTable: { assetId: 'modern_coffee_table_01', stage: 'decor' },
  pendantLamp: { assetId: 'modern_ceiling_lamp_01', stage: 'decor' },
  pictureFrame: { assetId: 'hanging_picture_frame_01', stage: 'decor' },
  pottedPlant: { assetId: 'potted_plant_01', stage: 'decor' },
  pachira: { assetId: 'pachira_aquatica_01', stage: 'decor' },
  vaseTall: { assetId: 'ceramic_vase_01', stage: 'decor' },
  vaseRound: { assetId: 'ceramic_vase_04', stage: 'decor' },
  clayPot: { assetId: 'planter_pot_clay', stage: 'decor' },
}

export function textureUrl(set: TextureSetId, map: TextureMap): string {
  return publicUrl(`assets/${textureFile(TEXTURE_SETS[set].assetId, map)}`)
}
export function modelUrl(model: ModelId): string {
  return publicUrl(`assets/${modelFile(MODELS[model].assetId)}`)
}

/** Node and material names inside the models (src/assets/assets.test.ts checks them against the GLB files). */
export const MODEL_PARTS = {
  clockHands: { hour: 'wall_clock_hours_hand', minute: 'wall_clock_minute_hand', second: 'wall_clock_second_hand' },
  pendantBulb: 'modern_ceiling_globe',
  frameArtwork: 'hanging_picture_frame_01_artwork',
} as const
/** Model materials whose name matches are glass (audit exemption). */
export const GLASS_MATERIAL = /_glass$/
/**
 * The TV picture, in the normalised television_02 frame (origin at the bottom centre, front +z).
 * Starting values; Task 11 aligns them on screenshots. center.z sits at most 6 mm in front of the model's front face.
 */
export const CRT_SCREEN = { width: 0.27, height: 0.2, center: [0, 0.235, 0.177] as [number, number, number] }
