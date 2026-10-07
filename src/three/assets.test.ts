import manifestJson from '../../scripts/assets/manifest.json'
import { assetManifestSchema } from '../assets/manifest'
import { publicUrl } from '../core/publicUrl'
import { MODELS, TEXTURE_SET_IDS, TEXTURE_SETS, modelUrl, textureUrl, type ModelId } from './assets'

const manifest = assetManifestSchema.parse(manifestJson)
const entry = (id: string) => manifest.assets.find((asset) => asset.id === id)

test('every texture set and model points to a manifest entry with the same stage, tile and metal flag', () => {
  for (const id of TEXTURE_SET_IDS) {
    const set = TEXTURE_SETS[id]
    // Textures dress the base of the scene: they load before the first image.
    expect(entry(set.assetId), id).toMatchObject({ kind: 'texture', stage: 'base', tileMetres: set.tileMetres, metal: set.metal })
  }
  for (const id of Object.keys(MODELS) as ModelId[]) {
    expect(entry(MODELS[id].assetId), id).toMatchObject({ kind: 'model', stage: MODELS[id].stage })
  }
  // Nothing is downloaded for nothing: every manifest entry is used once by the site.
  const used = [...Object.values(TEXTURE_SETS), ...Object.values(MODELS)].map((spec) => spec.assetId)
  expect([...used].sort()).toEqual(manifest.assets.map((asset) => asset.id).sort())
})

test('asset URLs go through publicUrl', () => {
  expect(textureUrl('floor', 'color')).toBe(publicUrl('assets/textures/plank_flooring_04_color.webp'))
  expect(textureUrl('blackMetal', 'arm')).toBe(publicUrl('assets/textures/metal046a_arm.webp'))
  expect(modelUrl('wallClock')).toBe(publicUrl('assets/models/wall_clock.glb'))
})
