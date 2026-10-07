import { z } from 'zod'

/*
 * Shared by the browser and the corrector server: server/*.ts imports this file directly with Node.
 * Keep it free of any import other than zod.
 */

export const BLOCK_TYPES = ['role', 'task', 'context', 'format', 'example', 'constraint'] as const
export type BlockType = (typeof BLOCK_TYPES)[number]
/** The four structural blocks, bottom to top: foundation, ground floor, upper floor, roof. */
export const CORE_BLOCKS = ['role', 'task', 'context', 'format'] as const satisfies readonly BlockType[]
export type CoreBlock = (typeof CORE_BLOCKS)[number]
export const BONUS_BLOCKS = ['example', 'constraint'] as const satisfies readonly BlockType[]

export function isCoreBlock(type: BlockType): type is CoreBlock {
  return (CORE_BLOCKS as readonly BlockType[]).includes(type)
}

export type Quality = 0 | 1 | 2 | 3
export const TIERS = ['vague', 'passable', 'excellent'] as const
export type Tier = (typeof TIERS)[number]
export const OUTCOMES = ['collapses', 'leans', 'holds'] as const
export type Outcome = (typeof OUTCOMES)[number]
export const OUTCOME_FOR_TIER = { vague: 'collapses', passable: 'leans', excellent: 'holds' } as const satisfies Record<Tier, Outcome>
export const MODES = ['blocks', 'free', 'fix'] as const
export type Mode = (typeof MODES)[number]

export const WORKSHOP_MISSION_COUNT = 6
export const MAX_ADA = 220
export const MAX_SITUATION = 400
export const MAX_ANSWER = 900
export const MAX_BLOCK_TEXT = 1000
export const MAX_FREE_TEXT = 3000
export const MAX_CORRECT_PROMPT = 4000
export const MAX_PURPOSE = 200
export const MAX_RUN_PROMPT = 6000

const SLUG = /^[a-z0-9-]+$/
const EMOJI = /[\p{Emoji_Presentation}\u{FE0F}]/u
/** Plain words only: letters, digits, spaces and ' . - % / & — `*` allowed once, as the last character. */
const PATTERN = /^[\p{L}\p{N} '.\-%/&]+\*?$/u

const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !EMOJI.test(value), { message: 'No emoji allowed' })
const pattern = z.string().regex(PATTERN, "Patterns are plain words: letters, digits, spaces, ' . - % / & and an optional trailing *")
const level = z.union([z.literal(1), z.literal(2), z.literal(3)])

export const detailSchema = z
  .object({ id: z.string().regex(SLUG), label: text(60), patterns: z.array(pattern).min(1), hint: text(MAX_ADA) })
  .strict()
export const blockSpecSchema = z
  .object({ required: z.boolean(), placeholder: text(160).optional(), details: z.array(detailSchema).min(1) })
  .strict()
export const conflictSchema = z
  .object({
    id: z.string().regex(SLUG),
    block: z.enum(BLOCK_TYPES),
    a: z.array(pattern).min(1),
    b: z.array(pattern).min(1),
    explain: text(MAX_ADA),
  })
  .strict()

const blockText = z.string().max(MAX_BLOCK_TEXT).optional()
export const blockInputSchema = z
  .object({ role: blockText, task: blockText, context: blockText, format: blockText, example: blockText, constraint: blockText })
  .strict()
export const promptInputSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('blocks'), blocks: blockInputSchema }).strict(),
  z.object({ mode: z.literal('free'), text: z.string().max(MAX_FREE_TEXT) }).strict(),
  z.object({ mode: z.literal('fix'), text: z.string().max(MAX_FREE_TEXT) }).strict(),
])

export const missionSchema = z
  .object({
    id: z.string().regex(SLUG),
    level,
    mode: z.enum(MODES),
    title: text(60),
    situation: text(MAX_SITUATION),
    goal: text(160),
    starter: text(MAX_FREE_TEXT).optional(),
    blocks: z
      .object({
        role: blockSpecSchema,
        task: blockSpecSchema,
        context: blockSpecSchema,
        format: blockSpecSchema,
        example: blockSpecSchema,
        constraint: blockSpecSchema,
      })
      .strict(),
    conflicts: z.array(conflictSchema),
    answers: z.object({ vague: text(MAX_ANSWER), passable: text(MAX_ANSWER), excellent: text(MAX_ANSWER) }).strict(),
    ada: z.object({ intro: text(MAX_ADA), success: text(MAX_ADA), takeaway: text(160) }).strict(),
    samples: z.array(z.object({ input: promptInputSchema, expect: z.enum(TIERS) }).strict()).min(3),
    reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()

export const missionIndexSchema = z.array(z.object({ id: z.string().regex(SLUG), level }).strict()).min(1)

const blockInfo = z.object({ label: text(30), building: text(40), good: text(200), example: text(200) }).strict()
export const blocksFileSchema = z
  .object({ role: blockInfo, task: blockInfo, context: blockInfo, format: blockInfo, example: blockInfo, constraint: blockInfo })
  .strict()

export const reportBlockSchema = z
  .object({
    type: z.enum(BLOCK_TYPES),
    quality: z.number().int().min(0).max(3),
    quote: z.string().max(500).nullable(),
    good: z.string().max(400),
    missing: z.string().max(400),
  })
  .strict()
export const correctorReportSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    verdict: z.enum(OUTCOMES),
    summary: z.string().min(1).max(600),
    blocks: z
      .array(reportBlockSchema)
      .length(BLOCK_TYPES.length)
      .refine((blocks) => BLOCK_TYPES.every((type) => blocks.filter((b) => b.type === type).length === 1), {
        message: 'Exactly one entry per block type',
      }),
    conflicts: z
      .array(z.object({ blocks: z.array(z.enum(BLOCK_TYPES)).length(2), explain: z.string().min(1).max(400) }).strict())
      .max(6),
    improvedPrompt: z.string().min(1).max(MAX_RUN_PROMPT),
    changes: z.array(z.string().min(1).max(300)).max(12),
  })
  .strict()

export const correctRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(MAX_CORRECT_PROMPT),
    purpose: z.string().trim().max(MAX_PURPOSE).optional(),
    lang: z.literal('en'),
  })
  .strict()
export const runRequestSchema = z.object({ prompt: z.string().trim().min(1).max(MAX_RUN_PROMPT) }).strict()
/** A run's answer; `truncated` when it was cut at the length limit (spec 3.9: the answers are capped). */
export const runResponseSchema = z.object({ answer: z.string(), truncated: z.boolean().optional() }).strict()
export const healthSchema = z.object({ corrector: z.boolean() }).strict()
export const API_ERRORS = ['invalid', 'rate', 'timeout', 'unavailable', 'error'] as const
export type ApiError = (typeof API_ERRORS)[number]
export const apiErrorSchema = z.object({ error: z.enum(API_ERRORS) }).strict()

export type Detail = z.infer<typeof detailSchema>
export type BlockSpec = z.infer<typeof blockSpecSchema>
export type Conflict = z.infer<typeof conflictSchema>
export type BlockTexts = z.infer<typeof blockInputSchema>
export type PromptInput = z.infer<typeof promptInputSchema>
export type Mission = z.infer<typeof missionSchema>
export type MissionIndex = z.infer<typeof missionIndexSchema>
export type BlocksFile = z.infer<typeof blocksFileSchema>
export type CorrectorReport = z.infer<typeof correctorReportSchema>
export type CorrectRequest = z.infer<typeof correctRequestSchema>
export type RunResponse = z.infer<typeof runResponseSchema>
