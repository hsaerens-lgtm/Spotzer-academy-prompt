import type { TFunction } from 'i18next'
import { materialOf, type BuildingInput } from '../../../workshop/building/plan'
import { CORE_BLOCKS, OUTCOME_FOR_TIER, type BlockType } from '../../../workshop/model'

/** The building in words, bottom to top, for screen readers and the plan view. */
export function describeBuilding(input: BuildingInput, labels: Record<BlockType, string>, t: TFunction): string {
  const floors = CORE_BLOCKS.map((block) => {
    const text = `${labels[block]}: ${t(`workshop.materials.${materialOf(input.qualities[block])}`)}`
    return input.cracked.includes(block) ? `${text} (${t('workshop.materials.cracked')})` : text
  })
  return `${floors.join(', ')}. ${t(`workshop.builder.outcome.${OUTCOME_FOR_TIER[input.tier]}`)}`
}
