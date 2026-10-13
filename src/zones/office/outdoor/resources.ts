// Ported from Horn.os (owner's project): js/scene/city.js (canvasTexture)
import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three'
import { paintLater } from '../../../three/paintLater'

/*
 * GPU resources of the outdoor, which is built outside React (like Horn.os) and rendered as <primitive> objects:
 * painted canvas textures, and their disposal (R3F never disposes a primitive).
 */

/**
 * A texture painted on a 2D canvas: sRGB unless told otherwise, repeated when `repeat` is given, anisotropy 8.
 * The canvas is painted once the stage holding the texture has queued its programs (paintLater, Task 16b), before the
 * warm frame: `draw` is not called before then.
 */
export function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  options: { repeat?: [number, number]; srgb?: boolean } = {},
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const texture = new CanvasTexture(canvas)
  if (options.srgb ?? true) texture.colorSpace = SRGBColorSpace
  if (options.repeat) {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(...options.repeat)
  }
  texture.anisotropy = 8
  return paintLater(texture, () => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvasTexture: no 2D canvas context')
    draw(context, width, height)
  })
}

/**
 * Disposes every geometry, material and material texture under `root`, each once, and every instanced mesh (which
 * frees its instance matrix and colour buffers on the GPU).
 */
export function disposeTree(root: Object3D): void {
  const geometries = new Set<{ dispose: () => void }>()
  const materials = new Set<Material>()
  const instanced: InstancedMesh[] = []
  root.traverse((object) => {
    const mesh = object as Partial<Mesh>
    if ((object as Partial<InstancedMesh>).isInstancedMesh) instanced.push(object as InstancedMesh)
    if (mesh.geometry) geometries.add(mesh.geometry)
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of list) materials.add(material)
  })
  for (const material of materials) {
    for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) (value as Texture).dispose()
    material.dispose()
  }
  for (const geometry of geometries) geometry.dispose()
  for (const mesh of instanced) mesh.dispose()
}
