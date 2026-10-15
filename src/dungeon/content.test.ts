import { getContent } from '../content/load'
import { evaluate } from '../workshop/engine/evaluate'
import { getDungeonContent } from './content'
import { mapIssues } from './map'
import { DOMAINS, FLOOR1_GUARDIANS, FLOORS } from './model'
import { correctIds, options } from './questions'

const content = getDungeonContent('en')
const office = getContent('en')
const all = FLOORS.flatMap((floor) => content.floors[floor].pools.flatMap((pool) => pool.questions.map((q) => ({ floor, q }))))

test('floor 1 has one guardian per office topic, in chapter order', () => {
  const order = office.chapters.flatMap((chapter) => chapter.topics)
  expect(content.floors[1].guardians.map((g) => g.topic)).toEqual(order)
  expect(content.floors[1].guardians).toHaveLength(FLOOR1_GUARDIANS)
  for (const guardian of content.floors[1].guardians) expect(guardian.line).toBe(office.topicById.get(guardian.topic!)!.takeaway)
})

test('the maps are closed, reachable, and their guardians unavoidable and in order', () => {
  for (const floor of FLOORS) {
    const { map, guardians, inscriptions } = content.floors[floor]
    expect(mapIssues(map, guardians.length)).toEqual([])
    expect(map.inscriptions).toHaveLength(inscriptions.length)
  }
})

test('every question follows its format rules', () => {
  const ids = new Set<string>()
  for (const { floor, q } of all) {
    expect(ids.has(q.id), q.id).toBe(false)
    ids.add(q.id)
    const right = correctIds(q)
    if (q.type === 'choice' || q.type === 'bestPrompt') expect(right, q.id).toHaveLength(1)
    if (q.type === 'multi') {
      expect(floor, `${q.id}: multi is for the expert floor`).toBe(2)
      expect(right.length, q.id).toBeGreaterThanOrEqual(2)
      expect(right.length, q.id).toBeLessThan(options(q).length)
    }
    for (const option of options(q)) expect(option.text, q.id).not.toMatch(/\b(all|none) of the above\b/i)
    if (floor === 1) expect(q.scenario, `${q.id}: scenarios are for the expert floor`).toBeUndefined()
  }
})

test('pools are big enough for a varied run', () => {
  for (const pool of content.floors[1].pools) expect(pool.questions.length).toBeGreaterThanOrEqual(4)
  for (const pool of content.floors[2].pools) expect(pool.questions.length).toBeGreaterThanOrEqual(6)
})

test('compliance questions cite an official source', () => {
  const compliance = content.floors[2].pools[DOMAINS.indexOf('compliance')]
  for (const q of compliance.questions) expect(q.source, q.id).toMatch(/^https:\/\//)
})

test('each boss: its starter collapses, its samples land on their tier, and a sample passes', () => {
  for (const floor of FLOORS) {
    const { mission } = content.floors[floor].boss
    expect(mission.mode).toBe('fix')
    expect(evaluate(mission, { mode: 'fix', text: mission.starter! }).tier).toBe('vague')
    for (const sample of mission.samples) expect(evaluate(mission, sample.input).tier, JSON.stringify(sample.input)).toBe(sample.expect)
    expect(mission.samples.some((s) => s.expect === 'excellent')).toBe(true)
  }
  expect(content.floors[2].boss.mission.blocks.constraint.required).toBe(true)
})

// Final review, finding 5: options are shuffled and numbered on screen, so an explanation never names one by letter.
test('explanations never point at an option by its letter', () => {
  const byLetter = /\b[A-F] (?:gives|is|has|names|adds|asks|tells|does|works)\b|\bfrom [A-F]\b|\b[A-F] and [A-F]\b|\b(?:option|prompt|answer) [A-F]\b/
  for (const { q } of all) expect(q.explanation, q.id).not.toMatch(byLetter)
})
