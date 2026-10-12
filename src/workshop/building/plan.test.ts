import { makeReport } from '../../test/workshopFixtures'
import type { BlockType, Quality, Tier } from '../model'
import { BONUS_LEAN_FACTOR, MATERIALS } from './materials'
import { inputFromReport, planBuilding, stabilityPercent } from './plan'

const input = (core: Quality[], tier: Tier, extra: { cracked?: BlockType[]; bonus?: [Quality, Quality] } = {}) => ({
  qualities: { role: core[0], task: core[1], context: core[2], format: core[3], example: extra.bonus?.[0] ?? 0, constraint: extra.bonus?.[1] ?? 0 },
  cracked: extra.cracked ?? [],
  tier,
})
const body = (plan: ReturnType<typeof planBuilding>, id: string) => plan.bodies.find((b) => b.id === id)!

test('an excellent building is welded floor to floor, the foundation rests on the ground', () => {
  const plan = planBuilding(input([3, 3, 3, 3], 'excellent'))
  expect(plan.bodies.map((b) => b.id)).toEqual(['role', 'task', 'context', 'format', 'ai'])
  expect(body(plan, 'role').link.kind).toBe('none')
  expect(['task', 'context', 'format'].map((id) => body(plan, id).link)).toEqual([
    { kind: 'weld', to: 'role', lean: 0, pivotSide: -1 },
    { kind: 'weld', to: 'task', lean: 0, pivotSide: 1 },
    { kind: 'weld', to: 'context', lean: 0, pivotSide: -1 },
  ])
  const task = body(plan, 'task')
  expect(task.position[1] - task.size[1] / 2).toBeCloseTo(body(plan, 'role').size[1])
})

test('a passable building hinges its weaker floors and leans them at impact', () => {
  const plan = planBuilding(input([3, 2, 1, 3], 'passable'))
  expect(body(plan, 'task').link).toMatchObject({ kind: 'hinge', to: 'role', lean: MATERIALS.wood.lean })
  expect(body(plan, 'context').link).toMatchObject({ kind: 'hinge', to: 'task', lean: MATERIALS.cardboard.lean })
  expect(body(plan, 'format').link.kind).toBe('weld')
  expect(body(plan, 'context').size[0]).toBeLessThan(body(plan, 'task').size[0])
})

test('a weaker foundation is hinged to the ground, a stone one rests on it', () => {
  expect(body(planBuilding(input([2, 3, 3, 3], 'passable')), 'role').link).toEqual({ kind: 'hinge', to: null, lean: MATERIALS.wood.lean, pivotSide: 1 })
  expect(body(planBuilding(input([3, 3, 2, 3], 'passable')), 'role').link.kind).toBe('none')
  const cracked = planBuilding(input([3, 3, 3, 3], 'passable', { cracked: ['role'] }))
  expect([body(cracked, 'role-left').link, body(cracked, 'role-right').link]).toMatchObject([
    { kind: 'hinge', to: null, pivotSide: -1 },
    { kind: 'hinge', to: null, pivotSide: 1 },
  ])
  expect(body(planBuilding(input([2, 1, 1, 1], 'vague')), 'role').link.kind).toBe('none')
})

test('bonus blocks add pillars and braces and make floors lean less', () => {
  const plan = planBuilding(input([3, 2, 3, 3], 'passable', { bonus: [3, 3] }))
  expect(plan.decorations.map((d) => d.kind)).toEqual(['pillar', 'pillar', 'brace', 'brace'])
  expect(body(plan, 'task').link.lean).toBeCloseTo(MATERIALS.wood.lean * BONUS_LEAN_FACTOR ** 2)
})

test('a hole leaves an empty slot and nothing to hold the floor above', () => {
  const plan = planBuilding(input([3, 0, 3, 3], 'vague'))
  expect(plan.slots[1]).toMatchObject({ block: 'task', material: 'hole' })
  expect(plan.bodies.some((b) => b.block === 'task')).toBe(false)
  expect(body(plan, 'context').link).toMatchObject({ kind: 'none', to: null })
})

test('a vague building has no joints and pushes its two highest bodies', () => {
  const plan = planBuilding(input([1, 1, 1, 1], 'vague'))
  expect(plan.bodies.filter((b) => b.block !== 'ai').every((b) => b.link.kind === 'none')).toBe(true)
  expect(plan.bodies.filter((b) => b.push > 0).map((b) => b.id)).toEqual(['context', 'format'])
})

test('a cracked roof on a vague building is pushed with the floor under it', () => {
  const plan = planBuilding(input([1, 1, 2, 1], 'vague', { cracked: ['format'] }))
  expect(plan.bodies.filter((b) => b.push > 0).map((b) => b.id)).toEqual(['context', 'format-left', 'format-right'])
})

test('a cracked floor becomes two halves that open outwards', () => {
  const plan = planBuilding(input([3, 3, 3, 3], 'passable', { cracked: ['format'] }))
  const left = body(plan, 'format-left')
  const right = body(plan, 'format-right')
  expect(left.link).toMatchObject({ kind: 'hinge', to: 'context', pivotSide: -1 })
  expect(right.link).toMatchObject({ kind: 'hinge', to: 'context', pivotSide: 1 })
  expect(left.position[0]).toBeLessThan(right.position[0])
})

test('the AI block appears above the top once the reading is over', () => {
  const plan = planBuilding(input([3, 3, 3, 3], 'excellent'))
  const ai = body(plan, 'ai')
  expect(ai.appearStep).toBe(plan.steps.aiSpawn)
  expect(ai.position[1]).toBeGreaterThan(plan.top)
})

test('a corrector report becomes a building input with the same tier rules', () => {
  const report = makeReport()
  expect(inputFromReport(report)).toEqual({
    qualities: { role: 3, task: 3, context: 1, format: 2, example: 0, constraint: 0 },
    cracked: [],
    tier: 'passable',
  })
  const clash = makeReport({ conflicts: [{ blocks: ['example', 'constraint'], explain: 'x' }] })
  expect(inputFromReport(clash).cracked).toEqual(['format'])
})

test('stability follows the average structural quality, minus cracks', () => {
  expect(stabilityPercent(input([3, 3, 3, 3], 'excellent'))).toBe(100)
  expect(stabilityPercent(input([3, 3, 1, 2], 'passable'))).toBe(75)
  expect(stabilityPercent(input([3, 3, 3, 3], 'passable', { cracked: ['format'] }))).toBe(85)
  expect(stabilityPercent(input([0, 0, 0, 0], 'vague'))).toBe(0)
})
