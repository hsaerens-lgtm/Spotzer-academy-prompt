import {
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type MeshStandardMaterialParameters,
  type Texture,
} from 'three'
import { brand } from '../core/brand'
import { TEXTURE_SETS, type TextureSetId } from './assets'
import { markExempt } from './audit'
import { noiseTexture } from './noise'
import { useTextureSets, type PbrTextures, type TextureSets } from './textures'
import { tints } from './tints'

/* ------------------------------------------------------------------ *
 *  PBR materials of the redesigned office (spec 2026-10-06, section 5)
 * ------------------------------------------------------------------ */

/**
 * How strongly each kind of surface reflects the scene environment (Lightformers), as a ratio of the phase's
 * environment intensity. These are ratios, not final values: three 0.186 ignores `material.envMapIntensity` unless
 * the material has its own `envMap`, so a ratio only takes effect through applyEnvironment() (below).
 */
export const ENV_MAP_INTENSITY = { surface: 1, model: 0.8, plant: 0.45 } as const

/** Records a material's environment ratio where applyEnvironment() reads it, and as its envMapIntensity. Returns it. */
function withEnvRatio<T extends MeshStandardMaterial>(material: T, ratio: number): T {
  material.envMapIntensity = ratio
  material.userData.envBase = ratio
  return material
}

/**
 * A textured PBR material from one texture set: colour map tinted by `tint`, normal map, and the ARM map read three
 * ways (R ambient occlusion, G roughness, B metalness; metalness only for metal sets).
 * `envMapIntensity` is the material's environment ratio (default ENV_MAP_INTENSITY.surface), see applyEnvironment().
 * `colorMap: false` leaves the colour map out, for a metal whose texture set is too dark to be its reflectance: the
 * base colour of a metal is its F0, so the tint alone sets it, and the normal and ARM maps carry the surface.
 */
export function pbrMaterial(
  textures: PbrTextures,
  options: { name: string; tint: string; metal: boolean; roughness?: number; envMapIntensity?: number; colorMap?: boolean },
): MeshStandardMaterial {
  return withEnvRatio(
    new MeshStandardMaterial({
      name: options.name,
      color: options.tint,
      map: options.colorMap === false ? null : textures.color,
      normalMap: textures.normal,
      roughnessMap: textures.arm,
      aoMap: textures.arm,
      metalnessMap: options.metal ? textures.arm : null,
      metalness: options.metal ? 1 : 0,
      roughness: options.roughness ?? 1,
    }),
    options.envMapIntensity ?? ENV_MAP_INTENSITY.surface,
  )
}

/** Every shared material of the office. Pure: works on plain Texture objects (unit tests) as on loaded ones. */
export function buildMaterials(sets: TextureSets) {
  const pbr = (name: string, set: TextureSetId, tint: string, extra: { roughness?: number; colorMap?: boolean } = {}) =>
    pbrMaterial(sets[set], { name, tint, metal: TEXTURE_SETS[set].metal, ...extra })
  const glow = (name: string, colour: string, emissiveIntensity: number, extra: MeshStandardMaterialParameters = {}) =>
    markExempt(new MeshStandardMaterial({ name, color: colour, emissive: colour, emissiveIntensity, ...extra }), 'emissive')
  return {
    floor: pbr('floor', 'floor', tints.floor),
    wall: pbr('wall', 'wall', tints.wall),
    ceiling: pbr('ceiling', 'wall', tints.ceiling),
    skirting: pbr('skirting', 'wall', tints.skirting),
    slats: pbr('slats', 'oak', tints.slats),
    oak: pbr('oak', 'oak', tints.oak),
    walnut: pbr('walnut', 'walnut', tints.walnut),
    chairFabric: pbr('chairFabric', 'fabric', tints.chairFabric),
    sofaFabric: pbr('sofaFabric', 'fabric', tints.sofaFabric),
    cushion: pbr('cushion', 'fabric', tints.cushion),
    rug: pbr('rug', 'carpet', tints.rug),
    // Black powder-coat on steel and aluminium: the metal046a textures as a dielectric (TEXTURE_SETS.blackMetal.metal is
    // false: no metalness map). As a tinted metal it was a black body (reflectance 0.023 x 0.11 = 0.0026, no diffuse term):
    // flat silhouettes, no highlights. As a coat its albedo is the tint times the colour map (about 0.04) and it catches
    // the lights (powderCoat.test.ts).
    blackMetal: pbr('blackMetal', 'blackMetal', tints.blackMetal),
    // The same textures with the colour map's own dark grey as the albedo (tint white), for a large face (the banquette's base).
    paintedSteel: pbr('paintedSteel', 'blackMetal', tints.paintedSteel),
    // Aluminium: metal027's colour map (mean sRGB 46) would cap its reflectance near black, so the tint is its colour.
    brushedMetal: pbr('brushedMetal', 'brushedMetal', tints.brushedMetal, { colorMap: false }),
    consoleShell: pbr('consoleShell', 'wall', tints.consoleShell, { roughness: 0.7 }),
    consoleDark: pbr('consoleDark', 'wall', tints.consoleDark, { roughness: 0.7 }),
    // Lacquered porcelain: a slight colour and roughness variation under a clear coat, so it reflects the phase.
    porcelain: withEnvRatio(
      new MeshPhysicalMaterial({
        name: 'porcelain',
        color: tints.porcelain,
        map: noiseTexture({ size: 128, min: 0.93, max: 1, seed: 3, srgb: true }),
        roughness: 0.22,
        roughnessMap: noiseTexture({ size: 128, min: 0.8, max: 1, seed: 5 }),
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
      ENV_MAP_INTENSITY.surface,
    ),
    // A thin pane: faint, reflective, no physical transmission (that would cost a second render of the scene).
    glass: markExempt(
      withEnvRatio(
        new MeshPhysicalMaterial({
          name: 'glass',
          color: tints.glass,
          transparent: true,
          opacity: 0.08,
          roughness: 0.05,
          metalness: 0,
          depthWrite: false,
          side: DoubleSide,
        }),
        1.5,
      ),
      'glass',
    ),
    screenOff: markExempt(new MeshStandardMaterial({ name: 'screenOff', color: brand.ink, roughness: 0.3, metalness: 0.1 }), 'screen'),
    limeGlow: glow('limeGlow', brand.lime, 0.8),
    mintGlow: glow('mintGlow', brand.mint, 0.6),
    // Logo, sign and ceiling lights: their emissive intensity follows the time of day (lighting/emissive.ts, Task 7),
    // except the ink squares of the mark: a faint constant glow, set here only (light on the wall by day, dark
    // against the lit plate at night).
    logoLime: glow('logoLime', brand.lime, 0.4),
    logoMint: glow('logoMint', brand.mint, 0.4),
    logoInk: glow('logoInk', brand.onDark, 0.1),
    signBack: markExempt(
      new MeshStandardMaterial({ name: 'signBack', color: brand.surface1, emissive: brand.onDark, emissiveIntensity: 0 }),
      'emissive',
    ),
    // A matt grey diffuser: it neither mirrors nor whitens in the daylight, and glows warm at dusk (Task 7 review).
    ceilingStrip: glow('ceilingStrip', tints.diffuserGlow, 0, { roughness: 0.85, color: tints.diffuser }),
    lampShade: glow('lampShade', tints.warmLight, 0, { roughness: 0.4 }),
  }
}

export type Materials = ReturnType<typeof buildMaterials>
export type MaterialKey = keyof Materials

/** Materials per TextureSets: built once, shared by every component, never disposed (the office lives as long as the page). */
const built = new WeakMap<TextureSets, Materials>()

/** The shared PBR materials. Suspends until the texture sets are loaded; use inside the Canvas. */
export function useMaterials(): Materials {
  const sets = useTextureSets()
  let materials = built.get(sets)
  if (!materials) {
    materials = buildMaterials(sets)
    built.set(sets, materials)
  }
  return materials
}

/**
 * Makes the environment ratios real. In three 0.186 a material reads its own `envMapIntensity` only when it has its
 * own `envMap`; with `scene.environment` alone the renderer overwrites that uniform with `scene.environmentIntensity`
 * (WebGLRenderer.js, WebGLMaterials.js). So the lighting hands every scene material the environment texture itself,
 * with the phase's intensity, and the material's ratio (`userData.envBase`) scales it: surfaces 1, models 0.8, plants 0.45.
 *
 * Standard and physical materials only; other types are left alone. `envBase` is captured on first sight from the
 * material's current `envMapIntensity` (so materials built elsewhere, such as GLB models, are picked up as they are)
 * and never recaptured, so a second call with another phase does not compound the first. `needsUpdate` is set only
 * when the `envMap` changes (a shader recompile): intensity alone is a uniform, cheap enough to set on every frame
 * of a phase transition.
 */
export function applyEnvironment(materials: Iterable<Material>, envMap: Texture | null, phaseIntensity: number): void {
  for (const material of materials) {
    if (!(material as Partial<MeshStandardMaterial>).isMeshStandardMaterial) continue // physical materials extend it
    const standard = material as MeshStandardMaterial
    standard.userData.envBase ??= standard.envMapIntensity
    if (standard.envMap !== envMap) {
      standard.envMap = envMap
      standard.needsUpdate = true
    }
    standard.envMapIntensity = (standard.userData.envBase as number) * phaseIntensity
  }
}
