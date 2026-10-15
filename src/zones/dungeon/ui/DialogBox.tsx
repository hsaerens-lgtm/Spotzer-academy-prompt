import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { options } from '../../../dungeon/questions'
import { RULES } from '../../../dungeon/score'
import { floorOf, useDungeon, useDungeonStore } from '../store'

const typing = (target: EventTarget) => target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text')

/**
 * A guardian's question (spec 3, §3.3): radio buttons, or check boxes for "select all that apply". Digits pick, Enter
 * answers. Keyed by guardian in DungeonApp, so a pick never carries over to the next one.
 */
export function DialogBox() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const run = useDungeon((s) => s.run)!
  const floor = useDungeon(floorOf)
  const index = run.current!
  const guardian = floor.guardians[index]
  const { question, order } = run.asked[index]
  const multi = question.type === 'multi'
  const all = options(question)
  const shown = order.map((id) => all.find((o) => o.id === id)!)
  const answer = run.phase === 'answered' ? run.answers[run.answers.length - 1] : null
  const immediate = RULES[run.floor].corrections === 'immediate'
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const box = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)

  // On opening: the first option takes the focus, and the question is read out.
  useEffect(() => {
    box.current?.querySelector('input')?.focus()
    store.getState().announce(`${t('dungeon.blocks', { name: guardian.name })} ${question.scenario ?? ''} ${question.question}`)
  }, [])

  useEffect(() => {
    if (!answer) return
    next.current?.focus()
    // Spec 3, §6.3: the result, then what changed: the guardian fading away with its line, or the hearts left.
    const parts = answer.correct
      ? [t('dungeon.correct'), t('dungeon.fades', { name: guardian.name }), guardian.line]
      : [t('dungeon.wrong'), immediate ? question.explanation : '', `${t('dungeon.hearts', { count: run.hearts })}.`]
    store.getState().announce(parts.filter(Boolean).join(' '))
  }, [answer])

  const toggle = (id: string) => {
    setError(null)
    setPicked((current) => (multi ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id]))
  }
  const submit = () => {
    if (picked.length === 0) {
      setError(t(multi ? 'dungeon.pickSome' : 'dungeon.pickOne'))
      return
    }
    store.getState().dispatch({ type: 'answer', picked })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (answer || typing(event.target)) return
    const digit = Number(event.key)
    if (Number.isInteger(digit) && digit >= 1 && digit <= shown.length) {
      event.preventDefault()
      toggle(shown[digit - 1].id)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="dg-dialog" role="dialog" aria-labelledby={titleId} ref={box} onKeyDown={onKeyDown}>
      <h2 id={titleId} className="dg-dialog__name">
        {guardian.name}
      </h2>
      {!answer ? (
        <>
          {question.scenario && <p className="dg-dialog__scenario">{question.scenario}</p>}
          <p className="dg-dialog__question">{question.question}</p>
          {multi && <p className="dg-dialog__hint">{t('dungeon.selectAll')}</p>}
          <fieldset className="dg-options">
            <legend className="sr-only">{question.question}</legend>
            {shown.map((option, i) => (
              <label key={option.id} className={`dg-option${question.type === 'bestPrompt' ? ' dg-option--prompt' : ''}`}>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={`dg-${question.id}`}
                  checked={picked.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span className="dg-option__key" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="dg-option__text">{option.text}</span>
              </label>
            ))}
          </fieldset>
          {error && (
            <p className="dg-error" role="alert">
              {error}
            </p>
          )}
          <div className="dg-actions">
            <button type="button" className="dg-btn dg-btn--primary" onClick={submit}>
              {t('dungeon.submit')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={`dg-result dg-result--${answer.correct ? 'right' : 'wrong'}`}>{answer.correct ? t('dungeon.correct') : t('dungeon.wrong')}</p>
          {/* A beaten guardian says its line on both floors; the expert floor only holds back explanations (spec 3, §3.3). */}
          {answer.correct && <p className="dg-line">{guardian.line}</p>}
          {immediate && !answer.correct && (
            <>
              <p className="dg-explanation">{question.explanation}</p>
              <p className="dg-review-topic">{t('dungeon.review', { topic: floor.itemTitles[index] })}</p>
            </>
          )}
          <div className="dg-actions">
            <button ref={next} type="button" className="dg-btn dg-btn--primary" onClick={() => store.getState().dispatch({ type: 'continue' })}>
              {t('dungeon.continue')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
