export const DEFAULT_PORT = 8787
/** Verified in the OpenAI model list on 2026-10-06. gpt-5-mini grades more carefully, at a higher cost. */
export const DEFAULT_MODEL = 'gpt-5.4-nano'

export interface ServerConfig {
  apiKey: string | null
  model: string
  port: number
  ratePerMinute: number
  ratePerDay: number
  globalPerDay: number
  /** GPT-5 models count their reasoning in max_output_tokens: keep room for it. */
  maxOutputCorrect: number
  maxOutputRun: number
  timeoutMs: number
  reasoningEffort: string | null
  trustProxy: boolean
}

type Env = Record<string, string | undefined>

const positive = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
const text = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function readConfig(env: Env): ServerConfig {
  return {
    apiKey: text(env.OPENAI_API_KEY),
    model: text(env.OPENAI_MODEL) ?? DEFAULT_MODEL,
    port: positive(env.PORT, DEFAULT_PORT),
    ratePerMinute: positive(env.RATE_PER_MINUTE, 10),
    ratePerDay: positive(env.RATE_PER_DAY, 100),
    globalPerDay: positive(env.GLOBAL_PER_DAY, 1000),
    maxOutputCorrect: positive(env.MAX_OUTPUT_TOKENS_CORRECT, 4000),
    maxOutputRun: positive(env.MAX_OUTPUT_TOKENS_RUN, 1500),
    timeoutMs: positive(env.OPENAI_TIMEOUT_MS, 30_000),
    reasoningEffort: text(env.OPENAI_REASONING_EFFORT),
    trustProxy: env.TRUST_PROXY === '1',
  }
}
