import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isEditable } from '../core/dom'
import { useContent } from '../core/selectors'
import { appStore, useApp } from '../core/store'
import { Button } from './Button'
import { CheckIcon, DeepIcon } from './Icons'
import './overlay.css'

export function TopicMenu({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation()
  const content = useContent()
  const seen = useApp((s) => s.progress.topicsSeen)
  const deeperSeen = useApp((s) => s.progress.deeperSeen)
  const [chapterId, setChapterId] = useState(content.chapters[0]?.id)
  const chapter = content.chapters.find((c) => c.id === chapterId) ?? content.chapters[0]

  useEffect(() => {
    if (embedded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isEditable(event.target)) appStore.getState().closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [embedded])

  return (
    <section
      className={`topic-menu panel at-card at-card--raised${embedded ? ' topic-menu--embedded' : ' bottom-panel'}`}
      aria-labelledby="topic-menu-title"
    >
      <header className="topic-menu__head">
        <h2 id="topic-menu-title" className="at-h2">
          {t('topics.menuTitle')}
        </h2>
        {!embedded && (
          <Button size="sm" variant="ghost" onClick={() => appStore.getState().closeMenu()}>
            {t('screen.close')}
          </Button>
        )}
      </header>
      <div role="tablist" className="topic-menu__tabs">
        {content.chapters.map((c, index) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === chapter?.id}
            className="topic-menu__tab"
            onClick={() => setChapterId(c.id)}
          >
            <span className="num">{String(index + 1).padStart(2, '0')}</span>
            {c.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="topic-menu__list">
        {chapter?.topics.map((id) => {
          const topic = content.topicById.get(id)
          if (!topic) return null
          return (
            <button
              key={id}
              type="button"
              className={`topic-pill${seen.includes(id) ? ' is-seen' : ''}`}
              onClick={() => appStore.getState().openTopic(id)}
            >
              <span className="topic-pill__title">{topic.title}</span>
              <span className="topic-pill__teaser">{topic.teaser}</span>
              <span className="topic-pill__marks">
                {seen.includes(id) && <CheckIcon label={t('topics.seen')} />}
                {deeperSeen.includes(id) && <DeepIcon label={t('topics.deeperSeen')} />}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
