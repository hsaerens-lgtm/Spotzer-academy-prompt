import { z } from 'zod'
import { missionSchema } from '../workshop/model'

export const FLOORS = [1, 2] as const
export type Floor = (typeof FLOORS)[number]
export const DOMAINS = ['security', 'compliance', 'monitoring', 'prompting', 'infrastructure'] as const
export type Domain = (typeof DOMAINS)[number]
/** Guardian shapes (32 x 32 pixel grids, src/zones/dungeon/pixels/sprites.ts), recoloured by a tint. */
export const SPRITES = ['knight', 'mimic', 'eye', 'goblin', 'hoarder', 'ghost', 'sphinx', 'slime', 'wraith'] as const
export type Sprite = (typeof SPRITES)[number]
export const BOSS_SPRITES = ['golem', 'agent'] as const
export type BossSprite = (typeof BOSS_SPRITES)[number]
export const TINTS = ['lime', 'mint', 'warn', 'onDark'] as const
export type Tint = (typeof TINTS)[number]
export const MAX = { question: 300, answer: 160, explanation: 400, scenario: 400, prompt: 600, name: 40, line: 160, title: 40 } as const
export const FLOOR1_GUARDIANS = 13
export const FLOOR2_GUARDIANS_PER_DOMAIN = 3

const EMOJI = /\p{Extended_Pictographic}/u
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !EMOJI.test(value), { message: 'No emoji allowed' })
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const answerSchema = z.object({ id: z.string().regex(/^[a-f]$/), text: text(MAX.answer), correct: z.boolean() }).strict()
const common = {
  id: slug,
  /** An incident scenario, shown above the question (expert floor). */
  scenario: text(MAX.scenario).optional(),
  question: text(MAX.question),
  explanation: text(MAX.explanation),
  /** Official source of a dated fact (required for compliance, spec 3 §5.1). */
  source: z
    .string()
    .regex(/^https:\/\/\S+$/)
    .optional(),
}
export const questionSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('choice'), answers: z.array(answerSchema).length(4) }).strict(),
  z.object({ ...common, type: z.literal('multi'), answers: z.array(answerSchema).min(4).max(6) }).strict(),
  z
    .object({
      ...common,
      type: z.literal('bestPrompt'),
      prompts: z
        .array(z.object({ id: z.string().regex(/^[a-c]$/), text: text(MAX.prompt), best: z.boolean() }).strict())
        .min(2)
        .max(3),
    })
    .strict(),
])
export type Question = z.infer<typeof questionSchema>

const looks = { name: text(MAX.name), sprite: z.enum(SPRITES), tint: z.enum(TINTS) }
export const floor1Schema = z
  .object({
    inscriptions: z.array(text(MAX.line)),
    guardians: z
      .array(z.object({ topic: slug, ...looks, questions: z.array(questionSchema).min(4) }).strict())
      .length(FLOOR1_GUARDIANS),
  })
  .strict()
export type Floor1File = z.infer<typeof floor1Schema>
export const floor2Schema = z
  .object({
    inscriptions: z.array(text(MAX.line)),
    domains: z
      .array(
        z
          .object({
            id: z.enum(DOMAINS),
            title: text(MAX.title),
            guardians: z.array(z.object({ ...looks, line: text(MAX.line) }).strict()).length(FLOOR2_GUARDIANS_PER_DOMAIN),
            questions: z.array(questionSchema).min(6),
          })
          .strict(),
      )
      .length(DOMAINS.length),
  })
  .strict()
export type Floor2File = z.infer<typeof floor2Schema>
export const DIRS = ['N', 'E', 'S', 'W'] as const
export const mapDefSchema = z.object({ dir: z.enum(DIRS), rows: z.array(z.string().min(3)).min(3) }).strict()
export type MapDef = z.infer<typeof mapDefSchema>
export const mapsSchema = z.object({ '1': mapDefSchema, '2': mapDefSchema }).strict()
const bossSchema = z.object({ name: text(MAX.name), sprite: z.enum(BOSS_SPRITES), mission: missionSchema }).strict()
export const bossesSchema = z.object({ '1': bossSchema, '2': bossSchema }).strict()
export type BossFile = z.infer<typeof bossSchema>
