import { i18n } from '../../../core/i18n'
import { describeBuilding } from './describe'

const labels = { role: 'Role', task: 'Task', context: 'Context', format: 'Format', example: 'Example', constraint: 'Constraint' }

test('describes each floor bottom to top, then the outcome', () => {
  const input = { qualities: { role: 3, task: 3, context: 1, format: 2, example: 0, constraint: 0 } as const, cracked: [], tier: 'passable' as const }
  expect(describeBuilding(input, labels, i18n.t)).toBe('Role: stone, Task: stone, Context: cardboard, Format: wood. The building leans.')
})

test('mentions holes and cracks', () => {
  const input = { qualities: { role: 0, task: 3, context: 3, format: 3, example: 0, constraint: 0 } as const, cracked: ['format' as const], tier: 'vague' as const }
  expect(describeBuilding(input, labels, i18n.t)).toBe('Role: a hole, Task: stone, Context: stone, Format: stone (cracked). The building collapses.')
})
