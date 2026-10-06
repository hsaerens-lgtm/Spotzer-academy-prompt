import { planBuilding } from './plan'
import { phaseAt, readingBlock, scanProgress } from './timeline'

const plan = planBuilding({ qualities: { role: 3, task: 3, context: 3, format: 3, example: 0, constraint: 0 }, cracked: [], tier: 'excellent' })

test('the animation goes placing, reading, loading, done', () => {
  expect(phaseAt(plan, 0)).toBe('placing')
  expect(phaseAt(plan, plan.steps.scanStart)).toBe('reading')
  expect(phaseAt(plan, plan.steps.aiSpawn)).toBe('loading')
  expect(phaseAt(plan, plan.steps.end)).toBe('done')
})

test('the reading line climbs from the foundation to the roof', () => {
  expect(scanProgress(plan, 0)).toBeNull()
  expect(scanProgress(plan, plan.steps.scanStart)).toBe(0)
  expect(readingBlock(plan, plan.steps.scanStart)).toBe('role')
  expect(readingBlock(plan, plan.steps.aiSpawn - 1)).toBe('format')
  expect(readingBlock(plan, plan.steps.aiSpawn)).toBeNull()
})
