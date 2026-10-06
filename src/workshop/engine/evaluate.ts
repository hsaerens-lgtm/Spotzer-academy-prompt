import { BLOCK_TYPES, CORE_BLOCKS, type BlockType, type Conflict, type Detail, type Mission, type PromptInput, type Quality, type Tier } from '../model'
import { qualityFor, tierFor } from './rules'
import { findFirst, normalizeText, sentenceSpan, type NormalizedText, type Span } from './text'

export type DetailSource = 'detected' | 'override' | 'none'

export interface DetailResult {
  id: string
  met: boolean
  source: DetailSource
  span: Span | null
}

export interface BlockResult {
  type: BlockType
  required: boolean
  present: boolean
  quality: Quality
  cracked: boolean
  details: DetailResult[]
  /** Block mode: passages in the block's own field. Free text: the sentences that mention the block. */
  spans: Span[]
}

export interface Evaluation {
  /** 'field': spans index each block's own field. 'text': spans index the free text. */
  source: 'field' | 'text'
  /** In BLOCK_TYPES order. */
  blocks: BlockResult[]
  conflicts: string[]
  tier: Tier
  passed: boolean
  weakest: BlockType | null
}

export type Advice =
  | { kind: 'success' }
  | { kind: 'hole'; block: BlockType; detail: Detail }
  | { kind: 'weak'; block: BlockType; quality: 1 | 2; detail: Detail }
  | { kind: 'cracked'; block: BlockType; conflict: Conflict }

const fieldText = (input: PromptInput, type: BlockType) => (input.mode === 'blocks' ? (input.blocks[type] ?? '') : input.text)

function uniqueSpans(spans: Span[]): Span[] {
  const seen = new Set<string>()
  return spans
    .filter((span) => {
      const key = `${span.start}:${span.end}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.start - b.start)
}

export function evaluate(mission: Mission, input: PromptInput, overrides: ReadonlySet<string> = new Set()): Evaluation {
  const fieldMode = input.mode === 'blocks'
  const whole = fieldMode ? null : normalizeText(input.text)
  const fields = new Map<BlockType, NormalizedText>()
  const scopeOf = (type: BlockType): NormalizedText => {
    if (whole) return whole
    let normalized = fields.get(type)
    if (!normalized) {
      normalized = normalizeText(fieldText(input, type))
      fields.set(type, normalized)
    }
    return normalized
  }

  const found = mission.conflicts.filter((conflict) => {
    const scope = scopeOf(conflict.block)
    return findFirst(scope, conflict.a) !== null && findFirst(scope, conflict.b) !== null
  })
  const crackedBlocks = new Set(found.map((conflict) => conflict.block))

  const blocks = BLOCK_TYPES.map((type): BlockResult => {
    const spec = mission.blocks[type]
    const scope = scopeOf(type)
    const raw = fieldText(input, type)
    const details = spec.details.map((detail): DetailResult => {
      const span = findFirst(scope, detail.patterns)
      if (span) return { id: detail.id, met: true, source: 'detected', span }
      if (overrides.has(detail.id)) return { id: detail.id, met: true, source: 'override', span: null }
      return { id: detail.id, met: false, source: 'none', span: null }
    })
    const met = details.filter((detail) => detail.met).length
    const present = fieldMode
      ? raw.trim() !== '' || details.some((detail) => detail.source === 'override')
      : met > 0
    const detected = details.flatMap((detail) => (detail.span ? [detail.span] : []))
    return {
      type,
      required: spec.required,
      present,
      quality: qualityFor(met, details.length, present),
      cracked: crackedBlocks.has(type),
      details,
      spans: fieldMode ? uniqueSpans(detected) : uniqueSpans(detected.map((span) => sentenceSpan(raw, span))),
    }
  })

  const required = blocks.filter((block) => block.required)
  const tier = tierFor(
    required.map((block) => block.quality),
    blocks.some((block) => block.cracked),
  )
  return {
    source: fieldMode ? 'field' : 'text',
    blocks,
    conflicts: found.map((conflict) => conflict.id),
    tier,
    passed: tier === 'excellent',
    weakest: pickWeakest(blocks),
  }
}

function pickWeakest(blocks: readonly BlockResult[]): BlockType | null {
  let weakest: BlockResult | null = null
  for (const block of blocks) {
    if (block.required && block.quality < 3 && (weakest === null || block.quality < weakest.quality)) weakest = block
  }
  if (weakest) return weakest.type
  return blocks.find((block) => block.cracked)?.type ?? null
}

export function blockResult(evaluation: Evaluation, type: BlockType): BlockResult {
  return evaluation.blocks.find((block) => block.type === type)!
}

function firstMissing(mission: Mission, result: BlockResult): Detail {
  const details = mission.blocks[result.type].details
  const index = result.details.findIndex((detail) => !detail.met)
  return details[index === -1 ? 0 : index]
}

export function adviceFor(mission: Mission, evaluation: Evaluation): Advice {
  if (evaluation.passed || evaluation.weakest === null) return { kind: 'success' }
  const result = blockResult(evaluation, evaluation.weakest)
  if (result.quality === 0) return { kind: 'hole', block: result.type, detail: firstMissing(mission, result) }
  if (result.quality < 3) return { kind: 'weak', block: result.type, quality: result.quality as 1 | 2, detail: firstMissing(mission, result) }
  const conflict = mission.conflicts.find((c) => c.block === result.type && evaluation.conflicts.includes(c.id))!
  return { kind: 'cracked', block: result.type, conflict }
}

/** Ada's live tip in free text: the first required hole or cardboard block, bottom to top, one detail at a time. */
export function nextTip(mission: Mission, evaluation: Evaluation, shown: ReadonlySet<string>): { block: BlockType; detail: Detail } | null {
  for (const type of CORE_BLOCKS) {
    const result = blockResult(evaluation, type)
    if (!result.required || result.quality > 1) continue
    const details = mission.blocks[type].details
    const detail = details.find((candidate, index) => !result.details[index].met && !shown.has(candidate.id))
    if (detail) return { block: type, detail }
  }
  return null
}

export function assemblePrompt(input: PromptInput, labels: Record<BlockType, string>): string {
  if (input.mode !== 'blocks') return input.text.trim()
  return BLOCK_TYPES.flatMap((type) => {
    const value = input.blocks[type]?.trim()
    return value ? [`${labels[type]}: ${value}`] : []
  }).join('\n')
}

export function isBlank(input: PromptInput): boolean {
  if (input.mode !== 'blocks') return input.text.trim() === ''
  return BLOCK_TYPES.every((type) => (input.blocks[type] ?? '').trim() === '')
}

export function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/u).length
}
