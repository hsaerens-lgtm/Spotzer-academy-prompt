import type { Tier } from '../workshop/model'
import { approach, isFloor, sameCell, type ParsedMap } from './map'
import type { Floor } from './model'
import { ahead, step, type Cell, type Command, type Pose } from './movement'
import { grade, type Asked } from './questions'
import { RULES, finalScore } from './score'

export type Phase = 'exploring' | 'encounter' | 'answered' | 'boss' | 'bossFeedback' | 'victory' | 'ejected'
export interface AnswerRecord {
  guardian: number
  picked: string[]
  correct: boolean
}
export interface BossAttempt {
  text: string
  tier: Tier
  passed: boolean
}
export interface RunState {
  floor: Floor
  seed: number
  asked: Asked[]
  pose: Pose
  defeated: boolean[]
  hearts: number
  phase: Phase
  /** The guardian of the open encounter, or of the answer on screen. */
  current: number | null
  answers: AnswerRecord[]
  boss: BossAttempt[]
  score: number
}
export type RunEvent =
  | { type: 'move'; command: Command }
  | { type: 'answer'; picked: string[] }
  | { type: 'continue' }
  | { type: 'bossResult'; text: string; tier: Tier; passed: boolean }
  | { type: 'advance' }
export type RunEffect = 'step' | 'bump' | 'encounter' | 'correct' | 'wrong' | 'boss' | 'bossHit' | 'victory' | 'ejected'
export interface RunTransition {
  state: RunState
  effect: RunEffect | null
}

const guardianAt = (map: ParsedMap, cell: Cell) => map.guardians.findIndex((g) => sameCell(g, cell))

function isOpen(map: ParsedMap, state: RunState, x: number, y: number): boolean {
  if (!isFloor(map, x, y) || sameCell(map.boss, { x, y })) return false
  const guardian = guardianAt(map, { x, y })
  return guardian < 0 || state.defeated[guardian]
}

/** Facing an undefeated guardian or the boss opens it. */
function checkAhead(map: ParsedMap, state: RunState): RunTransition {
  const cell = ahead(state.pose)
  const guardian = guardianAt(map, cell)
  if (guardian >= 0 && !state.defeated[guardian]) return { state: { ...state, phase: 'encounter', current: guardian }, effect: 'encounter' }
  if (sameCell(cell, map.boss)) return { state: { ...state, phase: 'boss', current: null }, effect: 'boss' }
  return { state, effect: null }
}

export function startRun(floor: Floor, map: ParsedMap, asked: Asked[], seed: number): RunState {
  const state: RunState = {
    floor,
    seed,
    asked,
    pose: map.start,
    defeated: asked.map(() => false),
    hearts: RULES[floor].hearts,
    phase: 'exploring',
    current: null,
    answers: [],
    boss: [],
    score: 0,
  }
  return checkAhead(map, state).state
}

const ejected = (state: RunState): RunTransition => ({ state: { ...state, phase: 'ejected', current: null }, effect: 'ejected' })

/** Pure: (state, event) → next state and the effect to play (sound, announcement). Invalid events change nothing. */
export function reduce(map: ParsedMap, state: RunState, event: RunEvent): RunTransition {
  const unchanged: RunTransition = { state, effect: null }
  switch (event.type) {
    case 'move': {
      if (state.phase !== 'exploring') return unchanged
      const moved = step(state.pose, event.command, (x, y) => isOpen(map, state, x, y))
      if (moved.bumped) return { state, effect: 'bump' }
      const next = checkAhead(map, { ...state, pose: moved.pose })
      return { state: next.state, effect: next.effect ?? (moved.turned ? null : 'step') }
    }
    case 'advance': {
      if (state.phase !== 'exploring') return unchanged
      const next = state.defeated.indexOf(false)
      const target = next >= 0 ? map.guardians[next] : map.boss
      const pose = approach(map, (x, y) => isOpen(map, state, x, y), target)
      return pose ? checkAhead(map, { ...state, pose }) : unchanged
    }
    case 'answer': {
      if (state.phase !== 'encounter' || state.current === null) return unchanged
      const guardian = state.current
      const correct = grade(state.asked[guardian].question, event.picked)
      return {
        state: {
          ...state,
          phase: 'answered',
          defeated: state.defeated.map((done, i) => done || i === guardian),
          hearts: correct ? state.hearts : state.hearts - 1,
          answers: [...state.answers, { guardian, picked: [...event.picked], correct }],
        },
        effect: correct ? 'correct' : 'wrong',
      }
    }
    case 'continue': {
      if (state.phase === 'answered') return state.hearts <= 0 ? ejected(state) : checkAhead(map, { ...state, phase: 'exploring', current: null })
      if (state.phase === 'bossFeedback') return state.hearts <= 0 ? ejected(state) : { state: { ...state, phase: 'boss' }, effect: null }
      return unchanged
    }
    case 'bossResult': {
      if (state.phase !== 'boss') return unchanged
      const boss = [...state.boss, { text: event.text, tier: event.tier, passed: event.passed }]
      if (event.passed) {
        const right = state.answers.filter((a) => a.correct).length
        return { state: { ...state, boss, phase: 'victory', score: finalScore(state.floor, right, boss.length) }, effect: 'victory' }
      }
      return { state: { ...state, boss, hearts: state.hearts - 1, phase: 'bossFeedback' }, effect: 'bossHit' }
    }
  }
}
