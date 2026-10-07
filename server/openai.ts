export const RESPONSES_URL = 'https://api.openai.com/v1/responses'

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface CallOptions {
  apiKey: string
  model: string
  instructions?: string
  input: string
  maxOutputTokens: number
  timeoutMs: number
  reasoningEffort: string | null
  jsonSchema?: { name: string; schema: object }
  /**
   * An answer cut at maxOutputTokens is still worth showing (a prompt run as is): it comes back with `truncated`.
   * Without it (a JSON report, useless when cut) the call is incomplete. Never sent to OpenAI.
   */
  acceptTruncated?: boolean
}

export type CallResult =
  | { ok: true; text: string; truncated?: true }
  | { ok: false; error: 'timeout' | 'upstream' | 'incomplete' | 'refused' }

interface ResponsesPayload {
  status?: string
  incomplete_details?: { reason?: string } | null
  output?: { type: string; content?: { type: string; text?: string }[] }[]
}

/** One call to the OpenAI Responses API. Nothing is stored on OpenAI's side (store: false). */
export async function callOpenAI(options: CallOptions, fetchImpl: FetchLike = fetch): Promise<CallResult> {
  const body: Record<string, unknown> = {
    model: options.model,
    input: options.input,
    max_output_tokens: options.maxOutputTokens,
    store: false,
  }
  if (options.instructions) body.instructions = options.instructions
  if (options.jsonSchema) {
    body.text = { format: { type: 'json_schema', name: options.jsonSchema.name, strict: true, schema: options.jsonSchema.schema } }
  }
  if (options.reasoningEffort) body.reasoning = { effort: options.reasoningEffort }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)
  try {
    const response = await fetchImpl(RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) return { ok: false, error: 'upstream' }
    const data = (await response.json()) as ResponsesPayload
    // Cut at the cap: the only incomplete answer that may still be read, and only by a caller that accepts one.
    const capped = options.acceptTruncated === true && data.status === 'incomplete' && data.incomplete_details?.reason === 'max_output_tokens'
    if (data.status !== 'completed' && !capped) return { ok: false, error: 'incomplete' }
    const parts = (data.output ?? []).filter((item) => item.type === 'message').flatMap((item) => item.content ?? [])
    if (parts.some((part) => part.type === 'refusal')) return { ok: false, error: 'refused' }
    const text = parts
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text ?? '')
      .join('')
    // Nothing written before the cap (all of it spent on reasoning) is no answer at all.
    if (!text) return { ok: false, error: capped ? 'incomplete' : 'upstream' }
    return capped ? { ok: true, text, truncated: true } : { ok: true, text }
  } catch {
    return { ok: false, error: controller.signal.aborted ? 'timeout' : 'upstream' }
  } finally {
    clearTimeout(timer)
  }
}
