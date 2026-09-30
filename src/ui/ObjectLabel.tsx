import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../core/store'
import { labelKey } from '../zones/office/interactions'

const OFFSET = { x: 16, y: 18 }

/** Tooltip naming the hovered 3D object, following the pointer. Plain DOM: drei <Html> would reset the wall screen's occlusion styles. */
export function ObjectLabel() {
  const { t } = useTranslation()
  const hovered = useApp((s) => s.hovered)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (event: PointerEvent) => setPointer({ x: event.clientX, y: event.clientY })
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  if (!hovered) return null
  return (
    <span className="object-label" role="tooltip" style={{ left: pointer.x + OFFSET.x, top: pointer.y + OFFSET.y }}>
      {t(labelKey[hovered])}
    </span>
  )
}
