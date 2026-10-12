// Ported from Horn.os (owner's project): js/scene/models.js (model)
import { Box3, Vector3, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { GLASS_MATERIAL } from './assets'
import { markExempt } from './audit'
import { ENV_MAP_INTENSITY } from './materials'

/*
 * Preparing the CC0 models for the office: a copy per placement, shadows, a softer environment reflection than the
 * surfaces built in code, glass exempt from the material audit, and a common frame (standing on y = 0, centred on x and
 * z, front +z) so that a layout position is the same for a model as for a procedural object.
 */

/** A placeable copy of a loaded model: nodes are cloned, geometries and materials stay shared with the loader cache. */
export function cloneModel(scene: Object3D): Object3D {
  return scene.clone(true)
}

/** Every mesh below `root`, root included. */
export function meshesOf(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })
  return meshes
}

const materialsOf = (mesh: Mesh): Material[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material])

/**
 * Shadows on (glass receives but casts none: a pane would darken what it covers), and each material once, however many
 * copies share it (userData.prepared): environment strength ENV_MAP_INTENSITY.model, glass marked for the audit.
 */
export function prepareModel(root: Object3D): void {
  for (const mesh of meshesOf(root)) {
    const materials = materialsOf(mesh)
    mesh.castShadow = !materials.every((material) => GLASS_MATERIAL.test(material.name))
    mesh.receiveShadow = true
    for (const material of materials) {
      if (material.userData.prepared) continue
      material.userData.prepared = true
      const standard = material as MeshStandardMaterial
      if (standard.isMeshStandardMaterial) standard.envMapIntensity = ENV_MAP_INTENSITY.model
      if (GLASS_MATERIAL.test(material.name)) markExempt(material, 'glass')
    }
  }
}

/** Uniform scale so that the bounding box of `root` is `height` metres tall. */
export function scaleToHeight(root: Object3D, height: number): void {
  const size = new Box3().setFromObject(root).getSize(new Vector3())
  if (size.y > 0) root.scale.multiplyScalar(height / size.y)
}

/** Moves `root` so that its bounding box stands on y = 0, centred on x and z. Returns the size of the box. */
export function normaliseModel(root: Object3D): Vector3 {
  const box = new Box3().setFromObject(root)
  const centre = box.getCenter(new Vector3())
  root.position.x -= centre.x
  root.position.y -= box.min.y
  root.position.z -= centre.z
  root.updateMatrixWorld(true)
  return box.getSize(new Vector3())
}
