import { Outlines, useCursor } from '@react-three/drei'
import { createContext, useContext, type ReactNode } from 'react'
import { brand } from '../core/brand'
import { appStore, useApp, type HoverTarget } from '../core/store'

export const HoverContext = createContext(false)

/** Put inside a mesh: draws a lime outline while the surrounding Interactive is hovered. `thickness` is in screen pixels. */
export function HoverOutline({ thickness = 3 }: { thickness?: number }) {
  const hovered = useContext(HoverContext)
  return hovered ? <Outlines screenspace thickness={thickness} color={brand.lime} /> : null
}

interface InteractiveProps {
  id: HoverTarget
  onActivate: () => void
  children: ReactNode
}

/**
 * Makes its children hoverable and clickable: lime outline, hand cursor, store `hovered`.
 * The tooltip is a DOM element (ui/ObjectLabel) so no drei <Html> resets the wall screen's occlusion.
 */
export function Interactive({ id, onActivate, children }: InteractiveProps) {
  const hovered = useApp((s) => s.hovered === id)
  const blocked = useApp((s) => s.transition !== null)
  const active = hovered && !blocked
  useCursor(active)
  return (
    <group
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!appStore.getState().transition) appStore.getState().setHovered(id)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        if (appStore.getState().hovered === id) appStore.getState().setHovered(null)
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (!appStore.getState().transition) onActivate()
      }}
    >
      <HoverContext.Provider value={active}>{children}</HoverContext.Provider>
    </group>
  )
}
