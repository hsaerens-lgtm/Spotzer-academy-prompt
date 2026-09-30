import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../core/store'
import { labelKey } from '../zones/office/interactions'

const OFFSET = { x: 16, y: 18 }

/**
 * Tooltip naming the hovered 3D object, following the pointer. Plain DOM: drei <Html> would reset the wall screen's occlusion styles.
 * The pointer is tracked in a ref so nothing re-renders while no object is hovered.
 */
export function ObjectLabel() {
  const { t } = useTranslation()
  const hovered = useApp((s) => s.hovered)
  const pointer = useRef({ x: 0, y: 0 })
  const [position, setPosition] = useState(pointer.current)

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY }
      if (appStore.getState().hovered) setPosition(pointer.current)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Hover just started: jump to the last known pointer position before the first paint.
  useLayoutEffect(() => {
    if (hovered) setPosition(pointer.current)
  }, [hovered])

  if (!hovered) return null
  return (
    <span className="object-label" role="tooltip" style={{ left: position.x + OFFSET.x, top: position.y + OFFSET.y }}>
      {t(labelKey[hovered])}
    </span>
  )
}
