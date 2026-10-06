import type { CorrectDeps } from './correct.ts'

export type RunResult = { ok: true; answer: string } | { ok: false; error: 'timeout' | 'unavailable' | 'error' }

/** Runs a prompt as is, with a capped answer, for "Run both". */
export async function runPrompt(prompt: string, deps: Pick<CorrectDeps, 'config' | 'apiKey' | 'call'>): Promise<RunResult> {
  const result = await deps.call({
    apiKey: deps.apiKey,
    model: deps.config.model,
    input: prompt,
    maxOutputTokens: deps.config.maxOutputRun,
    timeoutMs: deps.config.timeoutMs,
    reasoningEffort: deps.config.reasoningEffort,
  })
  if (result.ok) return { ok: true, answer: result.text }
  return { ok: false, error: result.error === 'timeout' ? 'timeout' : result.error === 'upstream' ? 'unavailable' : 'error' }
}
