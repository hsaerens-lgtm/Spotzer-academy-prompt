import type { Evaluation } from '../engine/evaluate'
import { tierFor } from '../engine/rules'
import { BLOCK_TYPES, CORE_BLOCKS, isCoreBlock, type BlockType, type CoreBlock, type CorrectorReport, type Quality, type Tier } from '../model'
import { AI_BLOCK, BONUS_LEAN_FACTOR, CRACK, DEPTH, FLOORS, MATERIALS, TIMELINE, VAGUE_PUSH, type Material } from './materials'

export type { Material } from './materials'

export interface BuildingInput {
  qualities: Record<BlockType, Quality>
  cracked: readonly BlockType[]
  tier: Tier
}

export interface Link {
  kind: 'weld' | 'hinge' | 'none'
  /** The body below; null for the ground under the foundation (or for nothing, above a hole). */
  to: string | null
  lean: number
  pivotSide: 1 | -1
}

export interface PlannedBody {
  id: string
  block: CoreBlock | 'ai'
  material: Material | 'ai'
  size: [number, number, number]
  position: [number, number, number]
  density: number
  friction: number
  restitution: number
  appearStep: number
  link: Link
  /** Sideways speed (m/s) the body is held at for VAGUE_SHOVE_STEPS steps from the impact (0: not pushed). */
  push: number
}

export interface Slot {
  block: CoreBlock
  bottom: number
  height: number
  material: Material | 'hole'
  cracked: boolean
}

export interface Decoration {
  kind: 'pillar' | 'brace'
  position: [number, number, number]
  size: [number, number, number]
  rotationZ: number
}

export interface BuildingPlan {
  tier: Tier
  bodies: PlannedBody[]
  slots: Slot[]
  decorations: Decoration[]
  top: number
  steps: { scanStart: number; aiSpawn: number; impact: number; end: number }
}

export const materialOf = (quality: Quality): Material | 'hole' =>
  quality === 3 ? 'stone' : quality === 2 ? 'wood' : quality === 1 ? 'cardboard' : 'hole'

export function inputFromEvaluation(evaluation: Evaluation): BuildingInput {
  const qualities = Object.fromEntries(evaluation.blocks.map((b) => [b.type, b.quality])) as Record<BlockType, Quality>
  return { qualities, cracked: evaluation.blocks.filter((b) => b.cracked).map((b) => b.type), tier: evaluation.tier }
}

export function inputFromReport(report: CorrectorReport): BuildingInput {
  const qualities = Object.fromEntries(
    BLOCK_TYPES.map((type) => [type, (report.blocks.find((b) => b.type === type)?.quality ?? 0) as Quality]),
  ) as Record<BlockType, Quality>
  // A crack must show on a structural floor: the first structural block of the pair, the roof otherwise.
  const cracked = [...new Set(report.conflicts.map((c) => c.blocks.find(isCoreBlock) ?? 'format'))]
  return { qualities, cracked, tier: tierFor(CORE_BLOCKS.map((type) => qualities[type]), cracked.length > 0) }
}

const noLink = (to: string | null, pivotSide: 1 | -1): Link => ({ kind: 'none', to, lean: 0, pivotSide })

export function planBuilding(input: BuildingInput): BuildingPlan {
  const { qualities, tier } = input
  const cracked = new Set(input.cracked)
  const bonuses = (qualities.example > 0 ? 1 : 0) + (qualities.constraint > 0 ? 1 : 0)
  const leanFactor = BONUS_LEAN_FACTOR ** bonuses
  const loose = tier === 'vague'
  const bodies: PlannedBody[] = []
  const slots: Slot[] = []
  let bottom = 0
  let below: PlannedBody | null = null

  CORE_BLOCKS.forEach((block, index) => {
    const floor = FLOORS[block]
    const material = materialOf(qualities[block])
    if (material === 'hole') {
      slots.push({ block, bottom, height: floor.height, material, cracked: false })
      bottom += floor.height
      below = null
      return
    }
    const spec = MATERIALS[material]
    const side: 1 | -1 = index % 2 === 0 ? 1 : -1
    const width = floor.width * spec.widthScale
    const height = floor.height * spec.heightScale
    const x = spec.offset * side
    const y = bottom + height / 2
    const base = {
      block,
      material,
      density: spec.density,
      friction: spec.friction,
      restitution: spec.restitution,
      appearStep: index * TIMELINE.placeInterval,
      push: 0,
    }
    const to: string | null = below?.id ?? null
    // `to: null` is the ground under the foundation; above a hole there is nothing to link to.
    const unsupported = !to && index > 0
    if (cracked.has(block)) {
      const half = (width - CRACK.gap) / 2
      const halfLink = (pivotSide: 1 | -1): Link =>
        loose || unsupported ? noLink(to, pivotSide) : { kind: 'hinge', to, lean: CRACK.lean * leanFactor, pivotSide }
      const left: PlannedBody = { ...base, id: `${block}-left`, size: [half, height, DEPTH], position: [x - (half + CRACK.gap) / 2, y, 0], link: halfLink(-1) }
      const right: PlannedBody = { ...base, id: `${block}-right`, size: [half, height, DEPTH], position: [x + (half + CRACK.gap) / 2, y, 0], link: halfLink(1) }
      bodies.push(left, right)
      below = left
    } else {
      // A stone foundation simply rests on the ground; a weaker one is hinged to it like any weaker floor.
      const link: Link =
        loose || unsupported || (!to && material === 'stone')
          ? noLink(to, side)
          : material === 'stone'
            ? { kind: 'weld', to, lean: 0, pivotSide: side }
            : { kind: 'hinge', to, lean: spec.lean * leanFactor, pivotSide: side }
      const body: PlannedBody = { ...base, id: block, size: [width, height, DEPTH], position: [x, y, 0], link }
      bodies.push(body)
      below = body
    }
    slots.push({ block, bottom, height, material, cracked: cracked.has(block) })
    bottom += height
  })

  if (loose) {
    // The two highest floors are pushed: both halves of a cracked floor, so a cracked roof cannot shield the floor below it.
    const highest = [...new Set(bodies.map((b) => b.block))].slice(-2)
    for (const body of bodies) if (highest.includes(body.block)) body.push = VAGUE_PUSH
  }

  const top = bottom
  const scanStart = CORE_BLOCKS.length * TIMELINE.placeInterval + TIMELINE.scanPause
  const aiSpawn = scanStart + TIMELINE.scanSteps
  const impact = aiSpawn + TIMELINE.fallSteps
  bodies.push({
    id: 'ai',
    block: 'ai',
    material: 'ai',
    size: [...AI_BLOCK.size],
    position: [0, top + AI_BLOCK.dropHeight + AI_BLOCK.size[1] / 2, 0],
    density: AI_BLOCK.density,
    friction: AI_BLOCK.friction,
    restitution: AI_BLOCK.restitution,
    appearStep: aiSpawn,
    link: noLink(null, 1),
    push: 0,
  })

  return {
    tier,
    bodies,
    slots,
    decorations: decorationsFor(qualities, slots),
    top,
    steps: { scanStart, aiSpawn, impact, end: impact + TIMELINE.settleSteps },
  }
}

function decorationsFor(qualities: Record<BlockType, Quality>, slots: Slot[]): Decoration[] {
  const decorations: Decoration[] = []
  const contextTop = slots[2].bottom + slots[2].height
  if (qualities.example > 0) {
    const x = FLOORS.role.width / 2 + 0.3
    for (const side of [-1, 1]) decorations.push({ kind: 'pillar', position: [side * x, contextTop / 2, 0], size: [0.22, contextTop, 0.22], rotationZ: 0 })
  }
  if (qualities.constraint > 0) {
    const bottom = slots[1].bottom
    const height = contextTop - bottom
    const width = 2
    const length = Math.hypot(width, height)
    const angle = Math.atan2(height, width)
    for (const sign of [1, -1]) {
      decorations.push({ kind: 'brace', position: [0, bottom + height / 2, DEPTH / 2 + 0.04], size: [length, 0.06, 0.04], rotationZ: sign * angle })
    }
  }
  return decorations
}

/** The stability gauge: average structural quality as a percentage, minus 15 points per cracked floor. */
export function stabilityPercent(input: BuildingInput): number {
  const mean = CORE_BLOCKS.reduce((sum, type) => sum + input.qualities[type], 0) / CORE_BLOCKS.length
  const cracks = input.cracked.filter(isCoreBlock).length
  return Math.max(0, Math.round((mean / 3) * 100) - 15 * cracks)
}
