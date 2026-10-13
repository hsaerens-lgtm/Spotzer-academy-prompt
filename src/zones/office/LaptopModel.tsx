import { useCallback, useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace, type BufferGeometry, type Object3D } from 'three'
import { AssetBoundary } from '../../three/AssetBoundary'
import { LAPTOP } from '../../three/assets'
import { markExempt } from '../../three/audit'
import { SceneObject } from '../../three/objects'
import { Laptop } from '../../three/props/Laptop'
import { fitLaptopScreen, laptopOutlined, paintWorkshopPreview } from '../../three/props/laptopModel'
import { layout } from './layout'

const PREVIEW_WIDTH = 480

/** The screen's picture: the workshop preview, lit as a screen is (unaffected by the room's light, exempt as a screen). */
function previewMaterial(): MeshBasicMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_WIDTH
  canvas.height = Math.round((PREVIEW_WIDTH * LAPTOP.screen.height) / LAPTOP.screen.width)
  const context = canvas.getContext('2d')
  if (context) paintWorkshopPreview(context, canvas.width, canvas.height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return markExempt(new MeshBasicMaterial({ name: 'laptop-screen', map: texture, toneMapped: false }), 'screen')
}

/**
 * The retro laptop at the end of the meeting table (classic_laptop, CC0), scaled to a real laptop's size, its screen
 * showing the workshop it opens. The hover outline goes round its body, not its glass. If the model cannot load, the
 * procedural laptop stands in, so the way to the workshop is always there.
 */
export function LaptopModel() {
  const { position, rotationY } = layout.objects.laptop
  const material = useMemo(previewMaterial, [])
  const fitted = useRef<BufferGeometry | null>(null)
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
      fitted.current?.dispose()
    },
    [material],
  )
  const onModel = useCallback(
    (root: Object3D) => {
      fitted.current = fitLaptopScreen(root, material)?.geometry ?? null
    },
    [material],
  )
  return (
    <AssetBoundary name="laptop" fallback={<Laptop name="laptop" position={position} rotation-y={rotationY} />}>
      <SceneObject
        object="laptop"
        name="laptop"
        outline={laptopOutlined}
        height={LAPTOP.height}
        onModel={onModel}
        position={position}
        rotation-y={rotationY}
      />
    </AssetBoundary>
  )
}
