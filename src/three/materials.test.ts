import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three'
import { brand } from '../core/brand'
import { TEXTURE_SET_IDS } from './assets'
import { isTextured } from './audit'
import { ENV_MAP_INTENSITY, buildMaterials, pbrMaterial, type MaterialKey } from './materials'
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
    signBack: brand.surface1, ceilingStrip: tints.warmLight, lampShade: tints.warmLight,
  }
  for (const key of KEYS) expect(m[key].color.getHexString(), key).toBe(new Color(expected[key]).getHexString())
  expect(m.limeGlow.emissive.getHexString()).toBe(new Color(brand.lime).getHexString())
  expect(m.signBack.emissive.getHexString()).toBe(new Color(brand.onDark).getHexString())
  expect(m.lampShade.emissive.getHexString()).toBe(new Color(tints.warmLight).getHexString())
  expect([tints.sofaFabric, tints.cushion, tints.porcelain, tints.visor]).toEqual([brand.blueGrey, brand.lime, brand.onDark, brand.nearBlack])
})
