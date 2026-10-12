import { useEffect, useRef } from 'react'
import type { MeshStandardMaterial, Object3D } from 'three'
import { GLASS_MATERIAL, MODEL_PARTS } from '../../../three/assets'
import { meshesOf } from '../../../three/gltf'
import { useMaterials } from '../../../three/materials'
import { noiseTexture } from '../../../three/noise'
import { SceneObject } from '../../../three/objects'
import { layout } from '../layout'
import { fitToUvRect, posterDesign, posterTexture, uvRect } from './posters'

/** One poster per frame, in layout order. */
const POSTER_SEEDS = [101, 103] as const

/** Two picture frames on the right wall (Poly Haven hanging_picture_frame_01), each with its own Athena poster. */
export function PictureFrames() {
  // The office's faint pane (shared, never disposed here).
  const { glass } = useMaterials()
  // The posters and their materials belong to this component: freed when the office goes away.
  const owned = useRef<{ dispose: () => void }[]>([])
  useEffect(
    () => () => {
      for (const item of owned.current) item.dispose()
      owned.current = []
    },
    [],
  )
  /**
   * Gives this copy's artwork its own material: the poster as colour, fitted to the artwork's UV rectangle, a fine paper
   * noise as roughness. The model's glass is its frame's colour map, metallic, with an opacity map the CC0 download leaves
   * out: as it comes, an opaque dark sheet over the poster. The office's glass takes its place.
   */
  const hangPoster = (root: Object3D, seed: number) => {
    for (const mesh of meshesOf(root)) {
      if (Array.isArray(mesh.material)) continue
      const artwork = mesh.material as MeshStandardMaterial
      if (GLASS_MATERIAL.test(artwork.name)) {
        mesh.material = glass
        continue
      }
      if (artwork.name !== MODEL_PARTS.frameArtwork) continue
      const poster = posterTexture(posterDesign(seed))
      fitToUvRect(poster, uvRect(mesh.geometry.getAttribute('uv')))
      const material = artwork.clone()
      material.map = poster
      material.roughnessMap = noiseTexture({ seed: 17 })
      material.needsUpdate = true
      mesh.material = material
      owned.current.push(poster, material)
    }
  }
  return (
    <>
      {layout.objects.frames.map((frame, index) => (
        <SceneObject
          key={index}
          object="pictureFrame"
          name={`frame-${index}`}
          position={frame.position}
          rotation-y={frame.rotationY ?? 0}
          onModel={(root) => hangPoster(root, POSTER_SEEDS[index % POSTER_SEEDS.length])}
        />
      ))}
    </>
  )
}
