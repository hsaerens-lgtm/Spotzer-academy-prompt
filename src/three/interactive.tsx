import { Outlines } from '@react-three/drei'
import { createContext, useContext } from 'react'
import { brand } from '../core/brand'

export const HoverContext = createContext(false)

/** Put inside a mesh: draws a lime outline while the surrounding Interactive is hovered. */
export function HoverOutline({ thickness = 0.008 }: { thickness?: number }) {
  const hovered = useContext(HoverContext)
  return hovered ? <Outlines thickness={thickness} color={brand.lime} /> : null
}
