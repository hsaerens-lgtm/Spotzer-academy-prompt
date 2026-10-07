import { useTranslation } from 'react-i18next'
import { materialOf } from '../../../workshop/building/plan'
import type { BlockResult } from '../../../workshop/engine/evaluate'

/** The blocks that get a badge: every required block (a missing one is a hole) and the optional blocks in use, never an empty extra. */
export const showsBadge = (result: BlockResult): boolean => result.required || result.present

/** The STONE / WOOD / CARDBOARD / HOLE / CRACKED tag of a tested block (studio and Before / After); a crack shows over the material. */
export function MaterialBadge({ result }: { result: BlockResult }) {
  const { t } = useTranslation()
  const badge = result.cracked ? 'cracked' : materialOf(result.quality)
  return <span className={`ws-material ws-material--${badge}`}>{t(`workshop.materialBadge.${badge}`)}</span>
}
