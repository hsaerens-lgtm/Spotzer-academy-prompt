import { useThree } from '@react-three/fiber'
import { EffectComposer, Pixelation, Vignette } from '@react-three/postprocessing'
import { useEffect, useState } from 'react'
import type { Floor } from '../../../dungeon/model'
import { PaletteEffect, paletteUniform } from '../effects/PaletteEffect'
import { PALETTES } from '../pixels/grids'
import { floorOf, useDungeon } from '../store'

/** How wide the picture should seem, in pixels (spec 3, §4.4). */
const APPARENT_WIDTH = 320

/**
 * The colours the picture snaps to: the floor's palette, plus a few in-between tones of its light (torchlit browns on
 * floor 1, cold blue-greys on floor 2) so lit stone keeps its warmth instead of jumping to grey.
 */
export const EFFECT_PALETTES: Record<Floor, string[]> = {
  1: [...Object.values(PALETTES[1]), '#2A1D12', '#4A3019', '#7A4E22', '#B07330'],
  2: [...Object.values(PALETTES[2]), '#16222B', '#22323E', '#2E4A5C', '#6F8FA3'],
}

/** One palette effect for the canvas's life: its colours and dither cell change through uniforms. */
function Palette({ floor, cell }: { floor: Floor; cell: number }) {
  const [effect] = useState(() => new PaletteEffect({ colours: EFFECT_PALETTES[floor], cell }))
  useEffect(() => {
    effect.uniforms.get('athenaCell')!.value = cell
    effect.uniforms.get('athenaPalette')!.value = paletteUniform(EFFECT_PALETTES[floor])
    effect.uniforms.get('athenaCount')!.value = EFFECT_PALETTES[floor].length
  }, [effect, floor, cell])
  useEffect(() => () => effect.dispose(), [effect])
  return <primitive object={effect} dispose={null} />
}

/**
 * Spec 3, §4.4: pixelation to about 320 pixels wide, the Athena palette with an ordered dither and monochrome scanlines
 * (one effect: postprocessing's own Scanline tints its lines magenta and green), then a vignette. Without a GPU (the e2e
 * browser), the vignette is left out.
 */
export function Effects({ software = false }: { software?: boolean }) {
  const width = useThree((s) => s.size.width)
  const floor = useDungeon((s) => floorOf(s).floor)
  const granularity = Math.max(2, Math.round(width / APPARENT_WIDTH))
  // A plain array: the composer reads its children as effects, so no empty fragments.
  const effects = [
    <Pixelation key="pixelation" granularity={granularity} />,
    <Palette key="palette" floor={floor} cell={granularity} />,
    ...(software
      ? []
      : [
          <Vignette key="vignette" eskil={false} offset={0.25} darkness={0.7} />,
        ]),
  ]
  return <EffectComposer multisampling={0}>{effects}</EffectComposer>
}
