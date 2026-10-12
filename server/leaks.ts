const PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'an OpenAI key (sk-...)', regex: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'the OPENAI_API_KEY variable', regex: /OPENAI_API_KEY/ },
  { name: 'the OpenAI API address', regex: /api\.openai\.com/ },
]

/** What a production file must never contain: the browser only ever talks to our own /api. */
export function findLeaks(text: string): string[] {
  return PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => pattern.name)
}
