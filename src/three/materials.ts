import {
  CanvasTexture,
  Color,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three'
import { brand } from '../core/brand'

function skyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#1D2B3B')
  gradient.addColorStop(0.6, '#56627A')
  gradient.addColorStop(1, '#D08F5E')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 4, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function build() {
  return {
    wall: new MeshStandardMaterial({ color: '#1C2023', roughness: 0.95 }),
    wallPanel: new MeshStandardMaterial({ color: brand.surface2, roughness: 0.9 }),
    ceiling: new MeshStandardMaterial({ color: '#16191B', roughness: 1 }),
    floor: new MeshStandardMaterial({ color: '#2B241F', roughness: 0.65 }),
    rug: new MeshStandardMaterial({ color: '#4A443D', roughness: 1 }),
    darkWood: new MeshStandardMaterial({ color: '#2E2723', roughness: 0.45, metalness: 0.05 }),
    fabric: new MeshStandardMaterial({ color: '#6E675F', roughness: 0.95 }),
    sofaFabric: new MeshStandardMaterial({ color: brand.blueGrey, roughness: 0.95 }),
    curtain: new MeshStandardMaterial({ color: '#6B6259', roughness: 1 }),
    metal: new MeshStandardMaterial({ color: '#2B2F33', roughness: 0.35, metalness: 0.8 }),
    plasticLight: new MeshStandardMaterial({ color: '#BDBBB4', roughness: 0.6 }),
    plasticDark: new MeshStandardMaterial({ color: '#34373A', roughness: 0.55 }),
    screenOff: new MeshStandardMaterial({ color: '#050607', roughness: 0.3, metalness: 0.1 }),
    warmGlow: new MeshBasicMaterial({ color: new Color('#FFD29A').multiplyScalar(1.15), toneMapped: false }),
    coveGlow: new MeshBasicMaterial({ color: new Color('#FFC98A').multiplyScalar(0.75), toneMapped: false }),
    lime: new MeshStandardMaterial({ color: brand.lime, emissive: brand.lime, emissiveIntensity: 0.45 }),
    mint: new MeshStandardMaterial({ color: brand.mint, emissive: brand.mint, emissiveIntensity: 0.35 }),
    ink: new MeshStandardMaterial({ color: brand.nearBlack, roughness: 0.45 }),
    logoLight: new MeshStandardMaterial({ color: brand.onDark, emissive: brand.onDark, emissiveIntensity: 0.15, roughness: 0.6 }),
    porcelain: new MeshPhysicalMaterial({
      color: '#F4F6F5',
      emissive: '#ffffff',
      emissiveIntensity: 0.06,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
    window: new MeshBasicMaterial({ map: skyTexture(), toneMapped: false }),
  }
}

export type Materials = ReturnType<typeof build>

let cache: Materials | null = null

/** Shared materials, created on first use (inside the Canvas). */
export function materials(): Materials {
  cache ??= build()
  return cache
}
