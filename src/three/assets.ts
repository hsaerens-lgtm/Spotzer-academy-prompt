import { modelFile, textureFile, type Stage, type TextureMap } from '../assets/paths'
import { publicUrl } from '../core/publicUrl'

export type TextureSetId = 'floor' | 'wall' | 'oak' | 'walnut' | 'fabric' | 'carpet' | 'blackMetal' | 'brushedMetal'
export interface TextureSetSpec {
  /** Manifest id (scripts/assets/manifest.json). */
  assetId: string
  /** Real-world size of one texture repeat, in metres (geometry UVs are in metres, see three/uv.ts). */
  tileMetres: number
  /** The office uses the set as a metal: metalness 1, read from the ARM map. False: a dielectric (metalness 0). */
  metal: boolean
}
export const TEXTURE_SETS: Record<TextureSetId, TextureSetSpec> = {
  floor: { assetId: 'plank_flooring_04', tileMetres: 2, metal: false },
  wall: { assetId: 'beige_wall_001', tileMetres: 3, metal: false },
  oak: { assetId: 'oak_veneer_05', tileMetres: 1, metal: false },
  walnut: { assetId: 'american_walnut_veneer', tileMetres: 1, metal: false },
  fabric: { assetId: 'fabric036', tileMetres: 0.5, metal: false },
  carpet: { assetId: 'carpet016', tileMetres: 1.7, metal: false },
  // A black powder-coat, not a black metal (Task 14c): every material of this set is a dielectric.
  blackMetal: { assetId: 'metal046a', tileMetres: 1, metal: false },
  brushedMetal: { assetId: 'metal027', tileMetres: 1, metal: true },
}
export const TEXTURE_SET_IDS = Object.keys(TEXTURE_SETS) as TextureSetId[]

export type ModelId =
  | 'sideboard' | 'television' | 'wallClock' | 'laptop' | 'sofa' | 'drawerCabinet' | 'coffeeTable' | 'pendantLamp'
  | 'pictureFrame' | 'pottedPlant' | 'pachira' | 'vaseTall' | 'vaseRound' | 'clayPot'
export interface ModelSpec {
  assetId: string
  stage: Stage
}
export const MODELS: Record<ModelId, ModelSpec> = {
  sideboard: { assetId: 'modern_wooden_cabinet', stage: 'base' },
  television: { assetId: 'television_02', stage: 'base' },
  wallClock: { assetId: 'wall_clock', stage: 'base' },
  laptop: { assetId: 'classic_laptop', stage: 'base' },
  sofa: { assetId: 'glam_velvet_sofa', stage: 'base' },
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
  pendantShell: 'modern_ceiling_lamp_01_glass',
  laptopScreen: 'classic_laptop_screen',
  frameArtwork: 'hanging_picture_frame_01_artwork',
} as const
/** Model materials whose name matches are glass (audit exemption). */
export const GLASS_MATERIAL = /_glass$/
/**
 * The TV picture, in the normalised television_02 frame (origin at the bottom centre, front +z), aligned on screenshots
 * in Task 11. The glass bulges from z 0.143 at its rim (x +/-0.153, y 0.144 to 0.370) to 0.175 at its centre, the
 * model's front face. The flat picture sits 2 mm in front of that centre (at most 6 mm): seen from the TV flight's end,
 * 37 cm away, it covers the glass up to its rim, edges bowed out included, and stays inside the bezel. 4:3, like its
 * textures.
 */
export const CRT_SCREEN = { width: 0.3, height: 0.225, center: [0, 0.258, 0.177] as [number, number, number] }
/**
 * The laptop on the meeting table: classic_laptop scaled to this height (about 34 cm wide, like a real one; the model is
 * 65 cm wide), and its screen glass in the scaled, normalised frame (origin at the bottom centre, front +z), measured
 * from the GLB (assets.test.ts). The glass is flat and upright, with no UVs of its own: LaptopModel gives it some.
 */
export const LAPTOP = {
  height: 0.283,
  screen: { width: 0.2336, height: 0.1914, center: [0, 0.1726, -0.1085] as [number, number, number] },
} as const
/** The artwork of hanging_picture_frame_01 in metres, as the scene shows it (measured: 0.5132 x 0.7615 m). */
export const FRAME_ARTWORK = { width: 0.513, height: 0.7615 } as const
