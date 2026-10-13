import type { Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D } from 'three'

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

const reasonOf = (target: { userData: Record<string, unknown> }): Exemption | undefined =>
  EXEMPTIONS.find((reason) => reason === target.userData.auditExempt)

/**
 * Whether a material lights itself: a lit material (standard, physical, Lambert, Phong) with a non-black `emissive`
 * colour, or an unlit MeshBasicMaterial (light strips and bulbs, often `toneMapped: false`) with a non-black `color`.
 * The colour counts, not the intensity: the intensity of a light follows the time of day.
 */
function emitsLight(material: Material): boolean {
  const basic = material as Partial<MeshBasicMaterial>
  const colour = basic.isMeshBasicMaterial ? basic.color : (material as Partial<MeshStandardMaterial>).emissive
  return colour !== undefined && colour.r + colour.g + colour.b > 0
}

/** An exemption holds for a material, except 'emissive' on a material that emits nothing: a flat plate cannot hide behind it. */
const holds = (reason: Exemption | undefined, material: Material) =>
  reason !== undefined && (reason !== 'emissive' || emitsLight(material))

/**
 * With a colour map: at least one surface map (normal or roughness). Without one: a metalness map and a normal map. A
 * metal's base colour is its reflectance, set by its tint, so its texture is the normal map plus the ARM map. The
 * roughness and metalness maps are one texture (the ARM map of pbrMaterial, the metallic-roughness map of a glTF), so
 * without a colour map the roughness map cannot be the second map: it would let any colourless ARM-only material through.
 * A model's material (marked by prepareModel) follows the spec's other branch, "a model with its own textures": any
 * texture of its own counts (a velvet sofa has a normal and an occlusion map, its colour set by its factors and sheen).
 */
export function isTextured(material: Material): boolean {
  const maps = material as Material & { map?: unknown; metalnessMap?: unknown; normalMap?: unknown; roughnessMap?: unknown; aoMap?: unknown }
  if (material.userData.prepared) return Boolean(maps.map || maps.normalMap || maps.roughnessMap || maps.metalnessMap || maps.aoMap)
  if (maps.map) return Boolean(maps.normalMap || maps.roughnessMap)
  return Boolean(maps.metalnessMap && maps.normalMap)
}

/**
 * Visible meshes (Mesh, InstancedMesh, SkinnedMesh; the object and all its ancestors visible) whose material, or one
 * of its materials, is neither textured nor exempt. A material that draws nothing (`visible` or `colorWrite` off, such
 * as a depth-only occluder) is not reported. An object is exempt when it or an ancestor is marked, and so is a material
 * marked itself; an 'emissive' mark only counts for a material that emits light (see emitsLight: a non-black emissive
 * colour, or for an unlit MeshBasicMaterial a non-black colour). Any other material type, a ShaderMaterial for
 * example, is reported unless it is marked.
 * Entries read `path#material`: path = names of the named ancestors (from `root`) and of the mesh, joined by '/';
 * material = its name, or its type when it has none.
 */
export function untexturedMeshes(root: Object3D): string[] {
  const inherited: Exemption[] = []
  for (let above = root.parent; above; above = above.parent) {
    if (!above.visible) return []
    const reason = reasonOf(above)
    if (reason) inherited.push(reason)
  }
  const found: string[] = []
  const visit = (object: Object3D, path: readonly string[], reasons: readonly Exemption[]) => {
    if (!object.visible) return
    const names = object.name ? [...path, object.name] : path
    const own = reasonOf(object)
    const here = own ? [...reasons, own] : reasons
    const mesh = object as Partial<Mesh>
    if (mesh.isMesh && mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        if (!material.visible || !material.colorWrite) continue
        if (isTextured(material) || holds(reasonOf(material), material) || here.some((reason) => holds(reason, material))) continue
        found.push(`${names.join('/')}#${material.name || material.type}`)
      }
    }
    for (const child of object.children) visit(child, names, here)
  }
  visit(root, [], inherited)
  return found
}
