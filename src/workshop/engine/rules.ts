// Type-only imports: the corrector server imports this file directly with Node.
import type { Quality, Tier } from '../model'

/** At least this share of a block's expected details makes it wood; all of them make it stone. */
export const WOOD_RATIO = 0.5
/** Below this average quality of the required blocks, the prompt is vague. */
export const VAGUE_MEAN = 1.5

export function qualityFor(met: number, total: number, present: boolean): Quality {
  if (!present) return 0
  const ratio = total === 0 ? 0 : met / total
  if (ratio >= 1) return 3
  if (ratio >= WOOD_RATIO) return 2
  return 1
}

export function tierFor(required: readonly Quality[], cracked: boolean): Tier {
  if (required.length === 0 || required.some((quality) => quality === 0)) return 'vague'
  const mean = required.reduce<number>((sum, quality) => sum + quality, 0) / required.length
  if (mean < VAGUE_MEAN) return 'vague'
  if (required.every((quality) => quality === 3) && !cracked) return 'excellent'
  return 'passable'
}
