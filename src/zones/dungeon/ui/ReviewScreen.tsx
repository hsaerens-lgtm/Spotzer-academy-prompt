import { useTranslation } from 'react-i18next'
import { correctIds, options } from '../../../dungeon/questions'
import { useDungeon } from '../store'

/** Spec 3, §3.6: the expert floor's corrections, shown at the end only. */
export function ReviewScreen() {
  const { t } = useTranslation()
  const run = useDungeon((s) => s.run)!
  return (
    <section className="dg-corrections" aria-labelledby="dg-corrections-title">
      <h3 id="dg-corrections-title" className="dg-corrections__title">
        {t('dungeon.corrections')}
      </h3>
      <ol className="dg-corrections__list">
        {run.answers.map((answer) => {
          const { question } = run.asked[answer.guardian]
          const all = options(question)
          const texts = (ids: string[]) => ids.map((id) => all.find((o) => o.id === id)?.text ?? id).join(' / ')
          return (
            <li key={answer.guardian} className={answer.correct ? 'is-right' : 'is-wrong'}>
              {question.scenario && <p className="dg-corrections__scenario">{question.scenario}</p>}
              <p className="dg-corrections__question">{question.question}</p>
              <p>{t('dungeon.yourAnswer', { answer: texts(answer.picked) })}</p>
              {!answer.correct && <p>{t('dungeon.rightAnswer', { answer: texts(correctIds(question)) })}</p>}
              <p className="dg-explanation">{question.explanation}</p>
              {question.source && (
                <a href={question.source} target="_blank" rel="noreferrer">
                  {t('dungeon.source')}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
