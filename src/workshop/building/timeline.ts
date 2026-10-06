import type { CoreBlock } from '../model'
import type { BuildingPlan } from './plan'

export type Phase = 'placing' | 'reading' | 'loading' | 'done'

export function phaseAt(plan: BuildingPlan, step: number): Phase {
  if (step < plan.steps.scanStart) return 'placing'
  if (step < plan.steps.aiSpawn) return 'reading'
  if (step < plan.steps.end) return 'loading'
  return 'done'
}

/** 0 → 1 while the AI reads the building, null otherwise. */
export function scanProgress(plan: BuildingPlan, step: number): number | null {
  if (step < plan.steps.scanStart || step >= plan.steps.aiSpawn) return null
  return (step - plan.steps.scanStart) / (plan.steps.aiSpawn - plan.steps.scanStart)
}

/** The structural slot the reading line is crossing. */
export function readingBlock(plan: BuildingPlan, step: number): CoreBlock | null {
  const progress = scanProgress(plan, step)
  if (progress === null) return null
  const height = progress * plan.top
  const slot = plan.slots.find((s) => height >= s.bottom && height < s.bottom + s.height) ?? plan.slots[plan.slots.length - 1]
  return slot.block
}
