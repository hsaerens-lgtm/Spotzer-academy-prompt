import { useTranslation } from 'react-i18next'
import type { BuildingInput } from '../../../workshop/building/plan'
import { isCoreBlock, OUTCOME_FOR_TIER, type BlockType, type CorrectorReport, type Quality } from '../../../workshop/model'
import { MaterialBadge, showsBadge } from '../missions/MaterialBadge'

export interface ReportProps {
  report: CorrectorReport
  /** The building made from the report: its tier (recomputed from the blocks) leads, the AI's score comes second. */
  building: BuildingInput
  labels: Record<BlockType, string>
}

export function Report({ report, building, labels }: ReportProps) {
  const { t } = useTranslation()
  const { tier } = building
  return (
    <div className="ws-report">
      <p className="ws-report__score">
        <span className={`ws-tier ws-tier--${tier}`}>
          {t('workshop.corrector.score', { score: report.score })}
          {' \u00b7 '}
          {t(`workshop.corrector.verdict.${OUTCOME_FOR_TIER[tier]}`)}
        </span>
      </p>
      <ul className="ws-report__blocks">
        {report.blocks.map((block) => {
          // A structural block is always rated (a missing one is a hole); an extra only once the prompt has it.
          const badge = {
            required: isCoreBlock(block.type),
            present: block.quality > 0,
            quality: block.quality as Quality,
            cracked: building.cracked.includes(block.type),
          }
          return (
            <li key={block.type} className="ws-report__block">
              <h3 className="ws-report__label">
                {labels[block.type]} {showsBadge(badge) && <MaterialBadge result={badge} />}
              </h3>
              {block.good && (
                <p>
                  <strong>{t('workshop.corrector.good')}</strong> {block.good}
                </p>
              )}
              {block.missing && (
                <p>
                  <strong>{t('workshop.corrector.missing')}</strong> {block.missing}
                </p>
              )}
              {block.quote && (
                <blockquote className="ws-report__quote">
                  <span className="sr-only">{t('workshop.corrector.quote')}: </span>
                  {block.quote}
                </blockquote>
              )}
            </li>
          )
        })}
      </ul>
      {report.conflicts.length > 0 && (
        <div className="ws-report__cracks">
          <h3 className="ws-report__label">{t('workshop.corrector.cracks')}</h3>
          <ul>
            {report.conflicts.map((conflict, index) => (
              <li key={index}>
                {labels[conflict.blocks[0]]} / {labels[conflict.blocks[1]]}: {conflict.explain}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
