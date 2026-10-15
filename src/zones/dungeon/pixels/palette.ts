import { brand } from '../../../core/brand'
import type { Floor, Tint } from '../../../dungeon/model'

/**
 * One letter per colour (spec 3, §4.4). Floor 1: torch-lit stone; floor 2: colder, shifted to blue-grey.
 * k ink · d dark stone · s stone · g light stone · b blue-grey · m mint · l lime · w warm (torchlight) · o off-white
 */
export const PALETTES: Record<Floor, Record<string, string>> = {
  1: { k: brand.ink, d: brand.surface2, s: brand.surface3, g: '#5A6168', b: brand.blueGrey, m: brand.mint, l: brand.lime, w: brand.warn, o: brand.onDark },
  2: { k: brand.ink, d: brand.surface1, s: brand.surface3, g: '#3E5566', b: brand.blueGrey, m: brand.mint, l: brand.lime, w: '#4A6B80', o: brand.onDark },
}

/** A guardian's tint fills its "T" pixels. */
export const TINT_COLOURS: Record<Tint, string> = { lime: brand.lime, mint: brand.mint, warn: brand.warn, onDark: brand.onDark }
