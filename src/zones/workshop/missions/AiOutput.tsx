import { useTranslation } from 'react-i18next'
import { assemblePrompt } from '../../../workshop/engine/evaluate'
import type { BlockType, Mission } from '../../../workshop/model'
import type { Attempt, MissionSession } from '../store'
import { Window } from '../ui/Window'
import { MaterialBadge, showsBadge } from './MaterialBadge'

function Answer({ mission, attempt }: { mission: Mission; attempt: Attempt }) {
  const { t } = useTranslation()
  const tier = attempt.evaluation.tier
  return (
    <div className="ws-answer">
      <span className={`ws-tier ws-tier--${tier}`}>{t(`workshop.output.tier.${tier}`)}</span>
      <p className="ws-answer__text">{mission.answers[tier]}</p>
    </div>
  )
}

export interface AiOutputProps {
  className?: string
  mission: Mission
  session: MissionSession
  revealed: boolean
  /** Before / After: the first attempt next to the latest one (the view only allows it when their prompts differ). */
  compare: boolean
  labels: Record<BlockType, string>
}

export function AiOutput({ className, mission, session, revealed, compare, labels }: AiOutputProps) {
  const { t } = useTranslation()
  const { first, last } = session
  return (
    <Window title={t('workshop.windows.output')} className={className}>
      {!last ? (
        <p className="ws-output__note">{t('workshop.output.empty')}</p>
      ) : !revealed ? (
        <p className="ws-output__note">{t('workshop.output.reading')}</p>
      ) : compare && first ? (
        <div className="ws-compare">
          {(
            [
              ['before', first],
              ['after', last],
            ] as const
          ).map(([key, attempt]) => (
            <section key={key} className="ws-compare__side">
              <h3 className="ws-compare__title">{t(`workshop.output.${key}`)}</h3>
              <pre className="ws-compare__prompt">{assemblePrompt(attempt.input, labels)}</pre>
              {/* What each block was made of. */}
              <ul className="ws-compare__blocks">
                {attempt.evaluation.blocks.filter(showsBadge).map((block) => (
                  <li key={block.type}>
                    {labels[block.type]} <MaterialBadge result={block} />
                  </li>
                ))}
              </ul>
              <Answer mission={mission} attempt={attempt} />
            </section>
          ))}
        </div>
      ) : (
        <Answer mission={mission} attempt={last} />
      )}
    </Window>
  )
}
