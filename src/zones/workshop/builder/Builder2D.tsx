import { useTranslation } from 'react-i18next'
import { materialOf, type BuildingInput } from '../../../workshop/building/plan'
import { CORE_BLOCKS, OUTCOME_FOR_TIER, type BlockType, type CoreBlock } from '../../../workshop/model'

const WIDTH = { stone: 100, wood: 86, cardboard: 60, hole: 100 } as const

export interface Builder2DProps {
  input: BuildingInput
  labels: Record<BlockType, string>
  onBlockClick?: (block: CoreBlock) => void
}

/** The building as a plan: one row per floor, roof first. Used without WebGL and in reading mode. */
export function Builder2D({ input, labels, onBlockClick }: Builder2DProps) {
  const { t } = useTranslation()
  const outcome = OUTCOME_FOR_TIER[input.tier]
  return (
    <ul className={`ws-plan ws-plan--${outcome}`} aria-label={t('workshop.builder.planLabel')}>
      {[...CORE_BLOCKS].reverse().map((block) => {
        const material = materialOf(input.qualities[block])
        const cracked = input.cracked.includes(block)
        return (
          <li key={block}>
            <button
              type="button"
              className={`ws-plan__row ws-plan__row--${material}${cracked ? ' is-cracked' : ''}`}
              style={{ width: `${WIDTH[material]}%` }}
              onClick={() => onBlockClick?.(block)}
            >
              <span className="ws-plan__label">{labels[block]}</span>
              <span className="ws-plan__material">
                {t(`workshop.materialBadge.${material}`)}
                {cracked && (
                  <span className="ws-plan__crack">
                    {' \u00B7 '}
                    {t('workshop.materialBadge.cracked')}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
