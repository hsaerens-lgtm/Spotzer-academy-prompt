import { useEffect, useRef } from 'react'
import { ADA_GRID, PALETTES } from '../pixels/grids'
import { gridToCanvas } from '../pixels/texture'

/** Ada's pixel portrait (spec 3, §2): 48 x 48 pixels, scaled up without smoothing by CSS. */
export function AdaPortrait() {
  const holder = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const canvas = gridToCanvas(ADA_GRID, PALETTES[1])
    holder.current?.replaceChildren(canvas)
  }, [])
  return <div ref={holder} className="dg-ada-portrait" aria-hidden="true" />
}
