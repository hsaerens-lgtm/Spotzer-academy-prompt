import type { TFunction } from 'i18next'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../../core/store'
import { materialOf } from '../../../workshop/building/plan'
import { getWorkshopContent } from '../../../workshop/content'
import { adviceFor, evaluate } from '../../../workshop/engine/evaluate'
import { MAX_FREE_TEXT, type BlockType, type Mission } from '../../../workshop/model'
import { isSubmitShortcut } from '../../workshop/keys'
import { floorOf, useDungeon, useDungeonStore } from '../store'
import { AdaPortrait } from './AdaPortrait'

/** Ada's advice on a failed attempt: the workshop's own words for the weakest block (spec 3, §3.4). */
export function bossAdvice(mission: Mission, text: string, labels: Record<BlockType, string>, t: TFunction): string {
  const advice = adviceFor(mission, evaluate(mission, { mode: 'fix', text }))
  switch (advice.kind) {
    case 'success':
      return mission.ada.success
    case 'hole':
      return `${t('workshop.ada.hole', { label: labels[advice.block] })} ${advice.detail.hint}`
    case 'weak':
      return `${t('workshop.ada.weak', { label: labels[advice.block], material: t(`workshop.materials.${materialOf(advice.quality)}`) })} ${advice.detail.hint}`
    case 'cracked':
      return `${t('workshop.ada.cracked', { label: labels[advice.block] })} ${advice.conflict.explain}`
  }
}

/** The boss: rewrite its prompt; the workshop's engine grades it offline. */
export function BossPanel() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const lang = useApp((s) => s.settings.lang)
  const run = useDungeon((s) => s.run)!
  const { boss } = useDungeon(floorOf)
  const { mission, name } = boss
  const [text, setText] = useState(mission.starter ?? '')
  const titleId = useId()
  const fieldId = useId()
  const field = useRef<HTMLTextAreaElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const last = run.boss[run.boss.length - 1]
  const feedback = run.phase === 'bossFeedback' && last ? bossAdvice(mission, last.text, getWorkshopContent(lang).labels, t) : null

  useEffect(() => {
    if (feedback) {
      next.current?.focus()
      store.getState().announce(`${t('dungeon.bossHit', { name })} ${feedback}`)
    } else {
      field.current?.focus()
      store.getState().announce(`${t('dungeon.bossIntro', { name })} ${mission.situation}`)
    }
  }, [run.phase])

  const submit = () => {
    if (!text.trim()) return
    const evaluation = evaluate(mission, { mode: 'fix', text })
    store.getState().dispatch({ type: 'bossResult', text, tier: evaluation.tier, passed: evaluation.passed })
  }

  return (
    <section className="dg-boss" role="dialog" aria-labelledby={titleId}>
      <AdaPortrait />
      <h2 id={titleId} className="dg-dialog__name">
        {name}
      </h2>
      {!feedback ? (
        <>
          <p className="dg-boss__intro">{mission.ada.intro}</p>
          <p className="dg-boss__situation">{mission.situation}</p>
          <p className="dg-boss__goal">{mission.goal}</p>
          <label className="dg-boss__label" htmlFor={fieldId}>
            {t('dungeon.yourPrompt')}
          </label>
          <textarea
            id={fieldId}
            ref={field}
            className="dg-boss__field"
            rows={6}
            maxLength={MAX_FREE_TEXT}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (!isSubmitShortcut(event)) return
              event.preventDefault()
              submit()
            }}
          />
          <div className="dg-actions">
            <button type="button" className="dg-btn dg-btn--primary" disabled={!text.trim()} aria-keyshortcuts="Control+Enter" onClick={submit}>
              {t('dungeon.bossSubmit')}
            </button>
            <span className="dg-shortcut" aria-hidden="true">
              {t('dungeon.bossShortcut')}
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="dg-result dg-result--wrong">{t('dungeon.bossHit', { name })}</p>
          <p className="dg-ada-says">
            <span className="dg-speaker">{t('dungeon.ada')}</span> {feedback}
          </p>
          <div className="dg-actions">
            <button ref={next} type="button" className="dg-btn dg-btn--primary" onClick={() => store.getState().dispatch({ type: 'continue' })}>
              {t('dungeon.continue')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
