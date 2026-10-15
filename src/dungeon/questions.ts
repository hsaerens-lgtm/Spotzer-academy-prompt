import type { Question } from './model'
import { shuffled } from './random'

export interface Option {
  id: string
  text: string
}
/** A pool of questions and the guardians (indexes in path order) that draw from it. */
export interface Pool {
  questions: Question[]
  guardians: number[]
}
/** The question a guardian asks in this run, with its options in display order. */
export interface Asked {
  question: Question
  order: string[]
}

export function options(question: Question): Option[] {
  return question.type === 'bestPrompt'
    ? question.prompts.map(({ id, text }) => ({ id, text }))
    : question.answers.map(({ id, text }) => ({ id, text }))
}

export function correctIds(question: Question): string[] {
  const right = question.type === 'bestPrompt' ? question.prompts.filter((p) => p.best) : question.answers.filter((a) => a.correct)
  return right.map((item) => item.id).sort()
}

/** All or nothing: the picked set equals the right set (duplicates and order do not matter). */
export function grade(question: Question, picked: readonly string[]): boolean {
  const right = correctIds(question)
  const set = [...new Set(picked)].sort()
  return set.length === right.length && set.every((id, i) => id === right[i])
}

/** One distinct question per guardian of each pool, options shuffled. Same `rand` sequence, same draw. */
export function draw(pools: readonly Pool[], guardianCount: number, rand: () => number): Asked[] {
  const asked: Asked[] = new Array(guardianCount)
  for (const pool of pools) {
    const picks = shuffled(pool.questions, rand).slice(0, pool.guardians.length)
    pool.guardians.forEach((guardian, i) => {
      asked[guardian] = { question: picks[i], order: shuffled(options(picks[i]).map((o) => o.id), rand) }
    })
  }
  return asked
}
