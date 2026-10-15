import { useTranslation } from 'react-i18next'
import { getContent } from '../content/load'
import { appStore, useApp } from '../core/store'
import { Button } from './Button'

/** Spec 3, §3.5 and §4.5: after a floor-1 ejection, Ada names the missed topics, with a button that opens each one. */
export function DungeonDebrief() {
  const { t } = useTranslation()
  const debrief = useApp((s) => s.dungeonDebrief)
  const lang = useApp((s) => s.settings.lang)
  if (!debrief) return null
  const topics = debrief.topics.map((id) => getContent(lang).topicById.get(id)).filter((topic) => topic !== undefined)
  if (topics.length === 0) return null
  const list = new Intl.ListFormat(lang, { type: 'conjunction' }).format(topics.map((topic) => topic.title))
  return (
    <div className="debrief">
      <p className="welcome__greeting">
        <span className="dialogue__speaker">{t('objects.ada')}</span>
        {t('welcome.debrief', { topics: list })}
      </p>
      <div className="welcome__actions">
        {topics.map((topic) => (
          <Button key={topic.id} variant="ghost" onClick={() => appStore.getState().openTopic(topic.id)}>
            {topic.title}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => appStore.getState().setDungeonDebrief(null)}>
          {t('welcome.notNow')}
        </Button>
      </div>
    </div>
  )
}
