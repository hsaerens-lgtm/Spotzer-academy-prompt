import type { Material, Object3D, Texture } from 'three'

/*
 * Canvas textures painted once the programs are queued (Task 16b). three compiles a program from the presence of a
 * map, not from its pixels: the outdoor's painted canvases (the park's foliage, lawn and gravel, the clouds: about
 * 130 ms of main thread on a cold page) can be painted while the GPU compiles, instead of before the compile starts.
 * Both loading stages paint what they hold right after queueing its programs (SceneReadySignal, DecorStage): before
 * the warm frame uploads anything, so the first image is unchanged.
 */

const pending = new WeakMap<Texture, () => void>()

/** Registers how to paint `texture`: it stays as it is until paintPending() reaches it. */
export function paintLater<T extends Texture>(texture: T, paint: () => void): T {
  pending.set(texture, paint)
  return texture
}

/**
 * Paints, once, every texture registered with paintLater() that a material under `root` holds (hidden objects
 * included), and marks it for upload.
 */
export function paintPending(root: Object3D): void {
  root.traverse((object) => {
    const material = (object as { material?: Material | Material[] }).material
    if (!material) return
    for (const one of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(one)) {
        const texture = value as Texture | null
        const paint = texture?.isTexture ? pending.get(texture) : undefined
        if (!texture || !paint) continue
        pending.delete(texture)
        paint()
        texture.needsUpdate = true
      }
    }
  })
}
