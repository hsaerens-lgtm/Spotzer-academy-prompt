import type { TFunction } from 'i18next'
import type { Mood } from '../../../content/schema'
import { materialOf } from '../../../workshop/building/plan'
import { adviceFor, blockResult } from '../../../workshop/engine/evaluate'
import { BONUS_BLOCKS, type BlockType, type Detail, type Mission } from '../../../workshop/model'
import type { Attempt } from '../store'

export type Tip = { block: BlockType; detail: Detail }
export type AdaAction = 'notNow' | 'edit' | 'alreadyThere' | 'next' | 'compare'

export interface AdaMessage {
  text: string
  mood: Mood
  pointing: boolean
  actions: AdaAction[]
}

export interface AdaContext {
  mission: Mission
  attempt: Attempt | null
  revealed: boolean
  tip: Tip | null
  sorry: Detail | null
  allDone: boolean
  labels: Record<BlockType, string>
  t: TFunction
}

function baseMessage(c: AdaContext): AdaMessage {
  const { t } = c
  if (c.tip) {
    return { text: `${t('workshop.ada.tipPrefix')} ${c.tip.detail.hint}`, mood: 'thinking', pointing: true, actions: ['notNow'] }
  }
  if (c.attempt && !c.revealed) return { text: t('workshop.output.reading'), mood: 'thinking', pointing: true, actions: [] }
  if (!c.attempt || c.attempt.id === 0) return { text: c.mission.ada.intro, mood: 'happy', pointing: false, actions: [] }
  const advice = adviceFor(c.mission, c.attempt.evaluation)
  switch (advice.kind) {
    case 'success': {
      const parts = [c.mission.ada.success, c.mission.ada.takeaway]
      if (BONUS_BLOCKS.some((type) => blockResult(c.attempt!.evaluation, type).present)) parts.push(t('workshop.ada.bonus'))
      if (c.allDone) parts.push(t('workshop.ada.allDone'))
      // Every mission passed: there is no next one to offer (the suggested mission would only fall back to the first).
      return { text: parts.join(' '), mood: 'happy', pointing: false, actions: c.allDone ? ['compare'] : ['next', 'compare'] }
    }
    case 'hole':
      return {
        text: `${t('workshop.ada.hole', { label: c.labels[advice.block] })} ${advice.detail.hint}`,
        mood: 'surprised',
        pointing: true,
        actions: ['edit', 'alreadyThere'],
      }
    case 'weak':
      return {
        text: `${t('workshop.ada.weak', { label: c.labels[advice.block], material: t(`workshop.materials.${materialOf(advice.quality)}`) })} ${advice.detail.hint}`,
        mood: 'thinking',
        pointing: true,
        actions: ['edit', 'alreadyThere'],
      }
    case 'cracked':
      return {
        text: `${t('workshop.ada.cracked', { label: c.labels[advice.block] })} ${advice.conflict.explain}`,
        mood: 'surprised',
        pointing: true,
        actions: ['edit'],
      }
  }
}

/** What Ada says in her bubble, from the mission state. Pure: the view only renders it. */
export function adaMessage(c: AdaContext): AdaMessage {
  const message = baseMessage(c)
  if (!c.sorry || c.tip) return message
  const sorry = c.t('workshop.ada.sorry', { example: c.sorry.patterns[0].replace(/\*$/, '') })
  return { ...message, text: `${sorry} ${message.text}`, mood: message.mood === 'thinking' ? 'happy' : message.mood }
}
