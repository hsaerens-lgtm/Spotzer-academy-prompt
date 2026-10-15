import type { Question } from './model'
import { correctIds, draw, grade, options, type Pool } from './questions'
import { seeded } from './random'

const choice = (id: string): Question => ({
  id,
  type: 'choice',
  question: `Question ${id}?`,
  answers: [
    { id: 'a', text: 'Right', correct: true },
    { id: 'b', text: 'Wrong one', correct: false },
    { id: 'c', text: 'Wrong two', correct: false },
    { id: 'd', text: 'Wrong three', correct: false },
  ],
  explanation: 'Because.',
})
const multi: Question = {
  id: 'm',
  type: 'multi',
  question: 'Pick all that apply.',
  answers: [
    { id: 'a', text: 'Yes', correct: true },
    { id: 'b', text: 'No', correct: false },
    { id: 'c', text: 'Yes too', correct: true },
    { id: 'd', text: 'No either', correct: false },
  ],
  explanation: 'A and C.',
}
const best: Question = {
  id: 'p',
  type: 'bestPrompt',
  question: 'Which prompt is better?',
  prompts: [
    { id: 'a', text: 'Write a post.', best: false },
    { id: 'b', text: "You are a copywriter. Write a 50-word Instagram post for Rosa's Flowers.", best: true },
  ],
  explanation: 'B gives a role, a platform and a length.',
}

test('options and right answers of each format', () => {
  expect(options(best).map((o) => o.id)).toEqual(['a', 'b'])
  expect(correctIds(multi)).toEqual(['a', 'c'])
  expect(correctIds(best)).toEqual(['b'])
})

test('grading is all or nothing, whatever the order of the picks', () => {
  expect(grade(choice('x'), ['a'])).toBe(true)
  expect(grade(choice('x'), ['b'])).toBe(false)
  expect(grade(multi, ['c', 'a'])).toBe(true)
  expect(grade(multi, ['a'])).toBe(false)
  expect(grade(multi, ['a', 'c', 'b'])).toBe(false)
  expect(grade(multi, [])).toBe(false)
  expect(grade(multi, ['a', 'a', 'c'])).toBe(true)
})

test('draw gives every guardian a distinct question of its pool, reproducibly', () => {
  const pools: Pool[] = [
    { questions: ['a1', 'a2', 'a3', 'a4'].map(choice), guardians: [0] },
    { questions: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map(choice), guardians: [1, 2, 3] },
  ]
  const one = draw(pools, 4, seeded(5))
  const two = draw(pools, 4, seeded(5))
  expect(one.map((a) => a.question.id)).toEqual(two.map((a) => a.question.id))
  expect(one[0].question.id).toMatch(/^a/)
  const second = one.slice(1).map((a) => a.question.id)
  expect(new Set(second).size).toBe(3)
  for (const id of second) expect(id).toMatch(/^b/)
  for (const asked of one) expect([...asked.order].sort()).toEqual(['a', 'b', 'c', 'd'])
})
