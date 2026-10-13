import { useTranslation } from 'react-i18next'
import type { Mission } from '../../../workshop/model'

export interface MissionListProps {
  missions: Mission[]
  passed: readonly string[]
  currentId: string
  suggestedId: string
  onSelect: (id: string) => void
}

const LEVELS = [1, 2, 3] as const

/** The missions by level: ticks on the passed ones, "Start here" on the suggested one (shown by MissionPicker). */
export function MissionList({ missions, passed, currentId, suggestedId, onSelect }: MissionListProps) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('workshop.missions.listLabel')}>
      {LEVELS.map((level) => {
        const list = missions.filter((mission) => mission.level === level)
        if (list.length === 0) return null
        return (
          <section key={level} className="ws-level">
            <h3 className="ws-level__title">{t(`workshop.levels.${level}`)}</h3>
            <ul className="ws-mission-list">
              {list.map((mission) => {
                const isPassed = passed.includes(mission.id)
                return (
                  <li key={mission.id}>
                    <button
                      type="button"
                      className="ws-mission"
                      aria-current={mission.id === currentId ? 'true' : undefined}
                      onClick={() => onSelect(mission.id)}
                    >
                      <span className={`ws-mission__tick${isPassed ? ' is-done' : ''}`} aria-hidden="true" />
                      <span className="ws-mission__title">{mission.title}</span>
                      {/* The space stays outside the hidden span: an accessible name trims each element's own text. */}
                      {isPassed && (
                        <>
                          {' '}
                          <span className="sr-only">({t('workshop.missions.passed')})</span>
                        </>
                      )}
                      {mission.id === suggestedId && !isPassed && <span className="ws-badge">{t('workshop.missions.startHere')}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </nav>
  )
}
