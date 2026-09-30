import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { button, useControls } from 'leva'
import { useEffect, useState } from 'react'
import type { Object3D } from 'three'
import { bumpLayout, layout, type Vec3 } from './layout'
import { TUNABLE, applyTransform, layoutSnapshot, type Tunable } from './tune'

type XYZ = { x: number; y: number; z: number }
const toXYZ = ([x, y, z]: Vec3): XYZ => ({ x, y, z })

/** Development only (?tune): drag objects with gizmos, edit the camera rail, copy the values. */
export default function TuneMode() {
  const scene = useThree((s) => s.scene)
  const [target, setTarget] = useState<Object3D | null>(null)

  const { object, mode } = useControls('Objects', {
    object: { options: [...TUNABLE], value: 'laptop' },
    mode: { options: ['translate', 'rotate'], value: 'translate' },
    'copy layout': button(() => {
      navigator.clipboard.writeText(JSON.stringify(layoutSnapshot(), null, 2)).catch((error) => console.warn('copy layout failed', error))
    }),
  })

  // leva's schema types do not follow a generated object, hence the loose record.
  const railSchema: Record<string, unknown> = {}
  layout.rail.forEach((point, index) => {
    railSchema[`p${index} position`] = {
      value: toXYZ(point.position),
      step: 0.05,
      onChange: (v: XYZ) => {
        point.position = [v.x, v.y, v.z]
        bumpLayout()
      },
    }
    railSchema[`p${index} target`] = {
      value: toXYZ(point.target),
      step: 0.05,
      onChange: (v: XYZ) => {
        point.target = [v.x, v.y, v.z]
        bumpLayout()
      },
    }
  })
  useControls('Camera rail', railSchema as Parameters<typeof useControls>[1])

  useEffect(() => {
    setTarget(scene.getObjectByName(object) ?? null)
  }, [scene, object])

  if (!target) return null
  return (
    <TransformControls
      object={target}
      mode={mode as 'translate' | 'rotate'}
      showX={mode === 'translate'}
      showZ={mode === 'translate'}
      onObjectChange={() => applyTransform(object as Tunable, target.position.toArray() as Vec3, target.rotation.y)}
    />
  )
}
