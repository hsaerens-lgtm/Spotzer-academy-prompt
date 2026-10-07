import type { Material, Mesh, Object3D } from 'three'

/*
 * Material audit (spec criterion 1): every visible surface of the office uses a textured PBR material, except
 * emissive materials, glass, screens and the sky. The test API exposes untexturedMeshes() to the e2e tests.
 */

export const EXEMPTIONS = ['emissive', 'glass', 'screen', 'sky'] as const
export type Exemption = (typeof EXEMPTIONS)[number]

/** Marks a material, or an object and everything below it, as exempt from the audit. Returns the target. */
export function markExempt<T extends { userData: Record<string, unknown> }>(target: T, reason: Exemption): T {
  target.userData.auditExempt = reason
  return target
}

const isExempt = (target: { userData: Record<string, unknown> }) =>
  (EXEMPTIONS as readonly unknown[]).includes(target.userData.auditExempt)

/** A colour map and at least one surface map (normal or roughness). */
export function isTextured(material: Material): boolean {
  const maps = material as Material & { map?: unknown; normalMap?: unknown; roughnessMap?: unknown }
  return Boolean(maps.map) && Boolean(maps.normalMap || maps.roughnessMap)
}

/**
 * Visible meshes (Mesh, InstancedMesh, SkinnedMesh; the object and all its ancestors visible) whose material, or one
 * of its materials, is neither textured nor exempt. An object is exempt when it or an ancestor is marked.
 * Entries read `path#material`: path = names of the named ancestors (from `root`) and of the mesh, joined by '/';
 * material = its name, or its type when it has none.
 */
export function untexturedMeshes(root: Object3D): string[] {
  let exemptAbove = false
  for (let above = root.parent; above; above = above.parent) {
    if (!above.visible) return []
    if (isExempt(above)) exemptAbove = true
  }
  const found: string[] = []
  const visit = (object: Object3D, path: readonly string[], exempt: boolean) => {
    if (!object.visible) return
    const names = object.name ? [...path, object.name] : path
    const skip = exempt || isExempt(object)
    const mesh = object as Partial<Mesh>
    if (!skip && mesh.isMesh && mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        if (!isExempt(material) && !isTextured(material)) found.push(`${names.join('/')}#${material.name || material.type}`)
      }
    }
    for (const child of object.children) visit(child, names, skip)
  }
  visit(root, [], exemptAbove)
  return found
}
