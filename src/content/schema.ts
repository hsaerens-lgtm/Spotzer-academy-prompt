import { z } from 'zod'

export const MOODS = ['neutral', 'happy', 'thinking', 'surprised', 'encouraging'] as const
export const GESTURES = ['none', 'wave', 'pointScreen', 'spin', 'nod', 'shrug'] as const
export type Mood = (typeof MOODS)[number]
export type Gesture = (typeof GESTURES)[number]

export const MAX_SAY = 220
const SLUG = /^[a-z0-9-]+$/
const EMOJI = /[\p{Emoji_Presentation}️]/u

const text = (max = 400) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !EMOJI.test(value), { message: 'No emoji allowed' })

export const beatSchema = z
  .object({
    say: text(MAX_SAY),
    mood: z.enum(MOODS).optional(),
    gesture: z.enum(GESTURES).optional(),
    screen: z.string().regex(/^[a-z0-9-]+:\d+$/).optional(),
  })
  .strict()

export const topicSchema = z
  .object({
    id: z.string().regex(SLUG),
    chapter: z.string().regex(SLUG),
    title: text(80),
    teaser: text(120),
    reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    basics: z.array(beatSchema).min(1),
    deeper: z.array(beatSchema).min(1),
    takeaway: text(160),
    next: z.string().regex(SLUG).nullable(),
  })
  .strict()

export const chaptersSchema = z
  .array(
    z
      .object({
        id: z.string().regex(SLUG),
        title: text(80),
        topics: z.array(z.string().regex(SLUG)).min(1),
      })
      .strict(),
  )
  .min(1)

export type Beat = z.infer<typeof beatSchema>
export type Topic = z.infer<typeof topicSchema>
export type Chapter = z.infer<typeof chaptersSchema>[number]

export interface ScreenRef {
  visualId: string
  step: number
}

export function parseScreenRef(ref: string): ScreenRef {
  const [visualId, step] = ref.split(':')
  return { visualId, step: Number(step) }
}
