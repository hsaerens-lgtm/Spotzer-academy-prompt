import { scoreInBand, tierFor } from '../src/workshop/engine/rules.ts'
import {
  BLOCK_TYPES,
  CORE_BLOCKS,
  OUTCOME_FOR_TIER,
  correctorReportSchema,
  type BlocksFile,
  type CorrectRequest,
  type CorrectorReport,
  type Quality,
} from '../src/workshop/model.ts'
import type { ServerConfig } from './config.ts'
import type { CallOptions, CallResult } from './openai.ts'
import { graderInput, graderInstructions } from './rubric.ts'

const blockType = { type: 'string', enum: [...BLOCK_TYPES] }

/** Strict Structured Outputs schema: every property required, no extra properties. */
export const REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'verdict', 'summary', 'blocks', 'conflicts', 'improvedPrompt', 'changes'],
  properties: {
    score: { type: 'integer' },
    verdict: { type: 'string', enum: ['collapses', 'leans', 'holds'] },
    summary: { type: 'string' },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'quality', 'quote', 'good', 'missing'],
        properties: {
          type: blockType,
          quality: { type: 'integer', enum: [0, 1, 2, 3] },
          quote: { type: ['string', 'null'] },
          good: { type: 'string' },
          missing: { type: 'string' },
        },
      },
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['blocks', 'explain'],
        properties: { blocks: { type: 'array', items: blockType }, explain: { type: 'string' } },
      },
    },
    improvedPrompt: { type: 'string' },
    changes: { type: 'array', items: { type: 'string' } },
  },
}

export type CorrectResult = { ok: true; report: CorrectorReport } | { ok: false; error: 'timeout' | 'unavailable' | 'error' }

export interface CorrectDeps {
  config: ServerConfig
  apiKey: string
  blocks: BlocksFile
  call: (options: CallOptions) => Promise<CallResult>
}

/**
 * Validates the AI's report, puts the blocks in building order, recomputes the verdict with the workshop rules and
 * keeps the score inside that verdict's band.
 */
export function parseReport(text: string): CorrectorReport | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = correctorReportSchema.safeParse(raw)
  if (!parsed.success) return null
  const report = parsed.data
  const blocks = BLOCK_TYPES.map((type) => report.blocks.find((block) => block.type === type)!)
  const tier = tierFor(
    CORE_BLOCKS.map((type) => blocks.find((block) => block.type === type)!.quality as Quality),
    report.conflicts.length > 0,
  )
  return { ...report, blocks, verdict: OUTCOME_FOR_TIER[tier], score: scoreInBand(report.score, tier) }
}

export async function correctPrompt(request: CorrectRequest, deps: CorrectDeps): Promise<CorrectResult> {
  const options: CallOptions = {
    apiKey: deps.apiKey,
    model: deps.config.model,
    instructions: graderInstructions(deps.blocks),
    input: graderInput(request.prompt, request.purpose),
    maxOutputTokens: deps.config.maxOutputCorrect,
    timeoutMs: deps.config.timeoutMs,
    reasoningEffort: deps.config.reasoningEffort,
    jsonSchema: { name: 'prompt_building_report', schema: REPORT_JSON_SCHEMA },
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await deps.call(options)
    if (!result.ok) {
      if (result.error === 'timeout') return { ok: false, error: 'timeout' }
      if (result.error === 'upstream') return { ok: false, error: 'unavailable' }
      continue
    }
    const report = parseReport(result.text)
    if (report) return { ok: true, report }
  }
  return { ok: false, error: 'error' }
}
