import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isButtonLike, isEditable } from '../core/dom'
import { useActiveTopic, useContent, useScreenRef } from '../core/selectors'
import { appStore, useApp } from '../core/store'
import { sound } from '../core/sound'
import { choicesFor, currentBeat, type Choice } from '../dialogue/engine'
import { Button } from './Button'
import { useTypewriter } from './useTypewriter'
import './overlay.css'

export function TypedLine({
  text,
  active,
  onDone,
  onReveal,
}: {
  text: string
  active: boolean
  onDone: () => void
  onReveal?: (char: string, index: number) => void
}) {
  const count = useTypewriter(text, { active, onDone, onReveal })
  return (
    <span className="dialogue__text" data-testid="dialogue-line" aria-hidden="true">
      {text.slice(0, count)}
    </span>
  )
}

export function DialogueBox() {
  const { t } = useTranslation()
  const topic = useActiveTopic()
  const content = useContent()
  const screenRef = useScreenRef()
  const dialogue = useApp((s) => s.dialogue)
  const reduced = useApp((s) => s.reducedMotion)
  const hasDialogue = dialogue !== null

  useEffect(() => {
    if (!hasDialogue) return
    const onKey = (event: KeyboardEvent) => {
      const state = appStore.getState()
      if (state.expandOpen || isEditable(event.target)) return
      if (event.key === 'Escape') {
        state.closeTopic()
        return
      }
      if ((event.key === ' ' || event.key === 'Enter') && !isButtonLike(event.target)) {
        // Ctrl/Alt/Meta + key is a browser or system shortcut. A held key repeats: only the first press advances.
        if (event.ctrlKey || event.altKey || event.metaKey) return
        event.preventDefault()
        if (!event.repeat) state.advanceDialogue()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasDialogue])

  useEffect(() => {
    if (reduced && dialogue?.phase === 'typing') appStore.getState().finishTyping()
  }, [reduced, dialogue])

  if (!dialogue || !topic) return null
  const beat = currentBeat(dialogue, topic)
  const choices = choicesFor(dialogue, topic, new Set(content.topicById.keys()))
  const { advanceDialogue, finishTyping, setExpandOpen } = appStore.getState()

  return (
    <section className="dialogue bottom-panel panel at-card at-card--raised" aria-label={t('objects.ada')}>
      <header className="dialogue__head">
        <span className="at-kicker">{topic.title}</span>
        <div className="dialogue__tools">
          {screenRef?.visualId === 'tokens' && (
            <Button size="sm" variant="solid" onClick={() => setExpandOpen(true)}>
              {t('dialogue.tryIt')}
            </Button>
          )}
          <Button size="sm" variant="solid" onClick={() => setExpandOpen(true)}>
            {t('screen.expand')}
          </Button>
        </div>
      </header>
      <button
        type="button"
        className="dialogue__line"
        onClick={advanceDialogue}
        onKeyDown={(event) => {
          // A browser turns each repeated Enter keydown on a focused button into a click: a held key must not skip beats.
          if (event.repeat) event.preventDefault()
        }}
        aria-label={t('dialogue.continueHint')}
      >
        <span className="dialogue__speaker" aria-hidden="true">
          {t('objects.ada')}
        </span>
        <TypedLine
          key={`${dialogue.topicId}-${dialogue.section}-${dialogue.beatIndex}`}
          text={beat.say}
          active={dialogue.phase === 'typing' && !reduced}
          onDone={finishTyping}
          onReveal={(char, index) => sound.blip(char, index)}
        />
      </button>
      {dialogue.phase !== 'choices' && (
        <p className="dialogue__hint" aria-hidden="true">
          {t('dialogue.continueHint')}
        </p>
      )}
      {dialogue.phase === 'choices' && (
        <div className="dialogue__choices">
          <p className="dialogue__takeaway">
            <strong>{t('dialogue.takeaway')}</strong> {topic.takeaway}
          </p>
          <div className="dialogue__buttons">
            {choices.map((choice, index) => (
              <ChoiceButton key={choice.kind} choice={choice} primary={index === 0 && choice.kind !== 'all'} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ChoiceButton({ choice, primary }: { choice: Choice; primary: boolean }) {
  const { t } = useTranslation()
  const content = useContent()
  const label =
    choice.kind === 'deeper'
      ? t('dialogue.deeper')
      : choice.kind === 'next'
        ? t('dialogue.nextTopic', { title: content.topicById.get(choice.topicId)?.title ?? '' })
        : t('dialogue.allTopics')
  return (
    <Button variant={primary ? 'primary' : 'ghost'} size="sm" onClick={() => appStore.getState().choose(choice)}>
      {label}
    </Button>
  )
}
