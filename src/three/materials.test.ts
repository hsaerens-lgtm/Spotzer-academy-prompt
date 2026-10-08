import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Texture,
} from 'three'
import { brand } from '../core/brand'
import { TEXTURE_SET_IDS } from './assets'
import { isTextured, untexturedMeshes } from './audit'
import { ENV_MAP_INTENSITY, applyEnvironment, buildMaterials, pbrMaterial, type MaterialKey } from './materials'
import type { TextureSets } from './textures'
import { tints } from './tints'

function fakeSets(): TextureSets {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
  return sets
}

const KEYS: MaterialKey[] = [
  'floor', 'wall', 'ceiling', 'skirting', 'slats', 'oak', 'walnut', 'chairFabric', 'sofaFabric', 'cushion', 'rug',
  'blackMetal', 'brushedMetal', 'consoleShell', 'consoleDark', 'porcelain', 'glass', 'screenOff',
  'limeGlow', 'mintGlow', 'logoLime', 'logoMint', 'logoInk', 'signBack', 'ceilingStrip', 'lampShade',
]

test('every shared material is textured or exempt', () => {
  const sets = fakeSets()
  const m = buildMaterials(sets)
  expect(Object.keys(m)).toEqual(KEYS)
  for (const key of KEYS) {
    const material = m[key]
    expect(isTextured(material) || typeof material.userData.auditExempt === 'string', key).toBe(true)
    expect(material.name).toBe(key)
    if (key === 'porcelain' || key === 'glass') expect(material, key).toBeInstanceOf(MeshPhysicalMaterial)
    else {
      expect(material, key).toBeInstanceOf(MeshStandardMaterial)
      expect(material, key).not.toBeInstanceOf(MeshPhysicalMaterial)
    }
  }
  expect(m.floor.map).toBe(sets.floor.color)
  expect(m.floor.normalMap).toBe(sets.floor.normal)
  expect(m.floor.roughnessMap).toBe(sets.floor.arm)
  expect(m.floor.aoMap).toBe(sets.floor.arm)
  // These check what the materials hold. three 0.186 renders envMapIntensity only once a material has its own envMap:
  // the rendered effect of the ratios comes through applyEnvironment() (tests at the end of this file).
  expect(m.floor.envMapIntensity).toBe(ENV_MAP_INTENSITY.surface)
  expect(m.ceiling.map).toBe(sets.wall.color)
  expect(m.rug.map).toBe(sets.carpet.color)
  expect(isTextured(m.porcelain)).toBe(true)
})

test('metal sets use the ARM blue channel for metalness', () => {
  const sets = fakeSets()
  const m = buildMaterials(sets)
  for (const key of ['blackMetal', 'brushedMetal'] as const) {
    expect(m[key].metalness, key).toBe(1)
    expect(m[key].metalnessMap, key).toBe(sets[key].arm)
    expect(m[key].roughnessMap, key).toBe(sets[key].arm)
  }
  for (const key of ['floor', 'oak', 'walnut', 'chairFabric', 'rug', 'consoleShell'] as const) {
    expect(m[key].metalness, key).toBe(0)
    expect(m[key].metalnessMap, key).toBeNull()
  }
  expect(m.consoleShell.roughness).toBe(0.7)
  expect(m.oak.roughness).toBe(1)
  const custom = pbrMaterial(sets.oak, { name: 'custom', tint: tints.oak, metal: false, roughness: 0.6, envMapIntensity: ENV_MAP_INTENSITY.model })
  expect(custom).toMatchObject({ name: 'custom', roughness: 0.6, envMapIntensity: 0.8, metalness: 0 })
  expect(custom.aoMap).toBe(sets.oak.arm)
})

test('glass is transparent and marked as glass', () => {
  const m = buildMaterials(fakeSets())
  expect(m.glass).toMatchObject({ transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, envMapIntensity: 1.5, depthWrite: false, side: DoubleSide })
  expect(m.glass.transmission).toBe(0)
  expect(m.glass.userData.auditExempt).toBe('glass')
  expect(m.screenOff.userData.auditExempt).toBe('screen')
  for (const key of ['limeGlow', 'mintGlow', 'logoLime', 'logoMint', 'logoInk', 'signBack', 'ceilingStrip', 'lampShade'] as const) {
    expect(m[key].userData.auditExempt, key).toBe('emissive')
  }
  expect([m.signBack.emissiveIntensity, m.ceilingStrip.emissiveIntensity, m.lampShade.emissiveIntensity]).toEqual([0, 0, 0])
  expect([m.limeGlow.emissiveIntensity, m.mintGlow.emissiveIntensity, m.logoInk.emissiveIntensity]).toEqual([0.8, 0.6, 0.2])
  expect(m.porcelain).toMatchObject({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 })
})

test('tints come from tints.ts and brand.ts', () => {
  const m = buildMaterials(fakeSets())
  const expected: Record<MaterialKey, string> = {
    floor: tints.floor, wall: tints.wall, ceiling: tints.ceiling, skirting: tints.skirting, slats: tints.slats,
    oak: tints.oak, walnut: tints.walnut, chairFabric: tints.chairFabric, sofaFabric: brand.blueGrey, cushion: brand.lime,
    rug: tints.rug, blackMetal: tints.blackMetal, brushedMetal: tints.brushedMetal, consoleShell: tints.consoleShell,
    consoleDark: tints.consoleDark, porcelain: brand.onDark, glass: tints.glass, screenOff: brand.ink,
    limeGlow: brand.lime, mintGlow: brand.mint, logoLime: brand.lime, logoMint: brand.mint, logoInk: brand.onDark,
    signBack: brand.surface1, ceilingStrip: tints.diffuser, lampShade: tints.warmLight,
  }
  for (const key of KEYS) expect(m[key].color.getHexString(), key).toBe(new Color(expected[key]).getHexString())
  expect(m.limeGlow.emissive.getHexString()).toBe(new Color(brand.lime).getHexString())
  expect(m.signBack.emissive.getHexString()).toBe(new Color(brand.onDark).getHexString())
  expect(m.lampShade.emissive.getHexString()).toBe(new Color(tints.warmLight).getHexString())
  // The ceiling strips: a matt grey diffuser by day that glows warm at dusk (Task 7 review).
  expect(m.ceilingStrip.emissive.getHexString()).toBe(new Color(tints.diffuserGlow).getHexString())
  expect(m.ceilingStrip.roughness).toBe(0.85)
  expect([tints.sofaFabric, tints.cushion, tints.porcelain, tints.visor]).toEqual([brand.blueGrey, brand.lime, brand.onDark, brand.nearBlack])
})

test('the shared materials pass the audit, and the emissive ones really have an emissive colour', () => {
  const m = buildMaterials(fakeSets())
  const box = new BoxGeometry()
  const room = new Group()
  for (const key of KEYS) room.add(Object.assign(new Mesh(box, m[key]), { name: key }))
  expect(untexturedMeshes(room)).toEqual([])
  for (const key of KEYS) {
    if (m[key].userData.auditExempt !== 'emissive') continue
    const { r, g, b } = m[key].emissive
    expect(r + g + b, key).toBeGreaterThan(0)
  }
  // The audit is not vacuous: a flat material among them is reported.
  room.add(Object.assign(new Mesh(box, new MeshStandardMaterial({ name: 'flat' })), { name: 'plate' }))
  expect(untexturedMeshes(room)).toEqual(['plate#flat'])
})

test('every material records its environment ratio', () => {
  const sets = fakeSets()
  const m = buildMaterials(sets)
  for (const key of ['floor', 'oak', 'blackMetal', 'consoleShell', 'porcelain'] as const) {
    expect(m[key].userData.envBase, key).toBe(ENV_MAP_INTENSITY.surface)
  }
  expect(m.glass.userData.envBase).toBe(1.5)
  const leaf = pbrMaterial(sets.oak, { name: 'leaf', tint: tints.oak, metal: false, envMapIntensity: ENV_MAP_INTENSITY.plant })
  expect(leaf.userData.envBase).toBe(0.45)
  expect(leaf.envMapIntensity).toBe(0.45)
})

test('applyEnvironment scales each ratio by the phase intensity', () => {
  const sets = fakeSets()
  const m = buildMaterials(sets)
  const leaf = pbrMaterial(sets.oak, { name: 'leaf', tint: tints.oak, metal: false, envMapIntensity: ENV_MAP_INTENSITY.plant })
  const env = new Texture()
  applyEnvironment([leaf, m.floor, m.glass, m.porcelain], env, 0.32)
  for (const material of [leaf, m.floor, m.glass, m.porcelain]) expect(material.envMap, material.name).toBe(env)
  expect(leaf.envMapIntensity).toBeCloseTo(0.45 * 0.32)
  expect(m.floor.envMapIntensity).toBeCloseTo(0.32)
  expect(m.porcelain.envMapIntensity).toBeCloseTo(0.32)
  // Physical materials too, and any iterable: the ratio of the glass is 1.5.
  applyEnvironment(new Set([m.glass, leaf]), env, 0.05)
  expect(m.glass.envMapIntensity).toBeCloseTo(1.5 * 0.05)
  expect(leaf.envMapIntensity).toBeCloseTo(0.45 * 0.05)
  expect(m.floor.envMapIntensity).toBeCloseTo(0.32)
})

test('a material built elsewhere is captured once and never compounded', () => {
  // As a GLB model arrives: no envBase, an envMapIntensity set directly.
  const model = new MeshStandardMaterial({ envMapIntensity: ENV_MAP_INTENSITY.model })
  const untouched = new MeshStandardMaterial()
  expect(model.userData.envBase).toBeUndefined()
  const env = new Texture()
  applyEnvironment([model, untouched], env, 0.32)
  expect(model.userData.envBase).toBe(0.8)
  expect(model.envMapIntensity).toBeCloseTo(0.8 * 0.32)
  expect(untouched.envMapIntensity).toBeCloseTo(0.32)
  applyEnvironment([model, untouched], env, 0.32)
  expect(model.envMapIntensity).toBeCloseTo(0.8 * 0.32)
  applyEnvironment([model, untouched], env, 0.18)
  expect(model.userData.envBase).toBe(0.8)
  expect(model.envMapIntensity).toBeCloseTo(0.8 * 0.18)
  expect(untouched.envMapIntensity).toBeCloseTo(0.18)
})

test('applyEnvironment leaves other material types alone', () => {
  const basic = new MeshBasicMaterial()
  const lambert = new MeshLambertMaterial()
  const shader = new ShaderMaterial()
  applyEnvironment([basic, lambert, shader], new Texture(), 0.32)
  for (const material of [basic, lambert, shader]) {
    expect(material.userData.envBase, material.type).toBeUndefined()
    expect((material as { envMap?: unknown }).envMap ?? null, material.type).toBeNull()
    expect(material.version, material.type).toBe(0)
  }
  expect(lambert.envMapIntensity).toBe(1)
})

test('needsUpdate is set only when the environment texture changes', () => {
  const material = new MeshStandardMaterial()
  const a = new Texture()
  const b = new Texture()
  applyEnvironment([material], null, 0.32)
  expect(material.version).toBe(0)
  applyEnvironment([material], a, 0.32)
  expect(material.version).toBe(1)
  applyEnvironment([material], a, 0.18)
  applyEnvironment([material], a, 0.05)
  expect(material.version).toBe(1)
  expect(material.envMapIntensity).toBeCloseTo(0.05)
  applyEnvironment([material], b, 0.05)
  expect(material.version).toBe(2)
  applyEnvironment([material], null, 0.05)
  expect(material.version).toBe(3)
  expect(material.envMap).toBeNull()
})
