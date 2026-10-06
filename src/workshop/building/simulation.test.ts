// @vitest-environment node
import RAPIER from '@dimforge/rapier3d-compat'
import { getWorkshopContent } from '../content'
import { evaluate } from '../engine/evaluate'
import { tierFor } from '../engine/rules'
import { CORE_BLOCKS, OUTCOME_FOR_TIER, type BlockType, type Quality, type Tier } from '../model'
import { inputFromEvaluation, planBuilding, type BuildingInput } from './plan'
import { createSimulation, measureOutcome } from './simulation'

beforeAll(async () => {
  await RAPIER.init()
})

function simulate(input: BuildingInput) {
  const simulation = createSimulation(planBuilding(input), RAPIER)
  simulation.runToEnd()
  const measure = measureOutcome(simulation)
  const positions = simulation.bodies.map((b) => b.body.translation())
  simulation.dispose()
  return { ...measure, positions }
}

const make = (core: Quality[], extra: { cracked?: BlockType[]; bonus?: [Quality, Quality]; tier?: Tier } = {}): BuildingInput => ({
  qualities: { role: core[0], task: core[1], context: core[2], format: core[3], example: extra.bonus?.[0] ?? 0, constraint: extra.bonus?.[1] ?? 0 },
  cracked: extra.cracked ?? [],
  tier: extra.tier ?? tierFor(core, (extra.cracked ?? []).length > 0),
})

const LEVELS: Quality[] = [0, 1, 2, 3]
const grid = LEVELS.flatMap((a) => LEVELS.flatMap((b) => LEVELS.flatMap((c) => LEVELS.map((d) => [a, b, c, d]))))

describe('every combination of structural qualities ends as its tier says', () => {
  for (const core of grid) {
    test(core.join(''), () => {
      const input = make(core)
      expect(simulate(input).outcome).toBe(OUTCOME_FOR_TIER[input.tier])
    })
  }
})

test.each([
  ['a cracked roof on stone', make([3, 3, 3, 3], { cracked: ['format'] }), 'leans'],
  ['a cracked upper floor', make([3, 2, 3, 3], { cracked: ['context'] }), 'leans'],
  ['a cracked vague building', make([1, 1, 1, 1], { cracked: ['format'] }), 'collapses'],
  ['stone with both bonus blocks', make([3, 3, 3, 3], { bonus: [3, 3] }), 'holds'],
  ['passable with both bonus blocks', make([3, 3, 2, 3], { bonus: [3, 3] }), 'leans'],
  ['vague with both bonus blocks', make([2, 1, 1, 1], { bonus: [3, 3] }), 'collapses'],
] as const)('%s', (_name, input, outcome) => {
  expect(simulate(input).outcome).toBe(outcome)
})

const content = getWorkshopContent('en')
const samples = content.missions.flatMap((mission) => mission.samples.map((sample, index) => ({ mission, sample, index })))

test.each(samples)('$mission.id sample $index looks the way its tier reads', ({ mission, sample }) => {
  const input = inputFromEvaluation(evaluate(mission, sample.input))
  expect(simulate(input).outcome).toBe(OUTCOME_FOR_TIER[sample.expect])
})

test('the same prompt always gives the same fall', () => {
  const input = make([2, 1, 1, 1])
  expect(simulate(input).positions).toEqual(simulate(input).positions)
})

// Regression sweep: every building without a hole, with no crack, one crack or two, and no bonus, one or both.
const SOLID: Quality[] = [1, 2, 3]
const solid = SOLID.flatMap((a) => SOLID.flatMap((b) => SOLID.flatMap((c) => SOLID.map((d) => [a, b, c, d]))))
const CRACKS: BlockType[][] = [[], ...CORE_BLOCKS.map((a) => [a]), ...CORE_BLOCKS.flatMap((a, i) => CORE_BLOCKS.slice(i + 1).map((b) => [a, b]))]
const BONUSES: [Quality, Quality][] = [[0, 0], [3, 0], [3, 3]]

describe('every crack and bonus pattern on a building without holes ends as its tier says', () => {
  for (const core of solid) {
    for (const cracked of CRACKS) {
      for (const bonus of BONUSES) {
        test(`${core.join('')} cracked ${cracked.join('+') || 'none'} bonus ${bonus.join('')}`, () => {
          const input = make(core, { cracked, bonus })
          expect(simulate(input).outcome).toBe(OUTCOME_FOR_TIER[input.tier])
        })
      }
    }
  }
})

test('a disposed simulation can be disposed again and no longer moves', () => {
  const simulation = createSimulation(planBuilding(make([3, 3, 3, 3])), RAPIER)
  simulation.advance()
  simulation.dispose()
  expect(() => simulation.dispose()).not.toThrow()
  expect(simulation.advance()).toEqual([])
  simulation.runToEnd()
  expect(simulation.step).toBe(1)
})

test('a link to a body missing from the plan is an error', () => {
  const plan = planBuilding(make([3, 3, 3, 3]))
  const broken = { ...plan, bodies: plan.bodies.map((b) => (b.id === 'task' ? { ...b, link: { ...b.link, to: 'nowhere' } } : b)) }
  expect(() => createSimulation(broken, RAPIER)).toThrow('Body "task" is linked to "nowhere", which is not in the plan')
})
