// @vitest-environment node
import { DEFAULT_MODEL, DEFAULT_PORT, readConfig } from './config.ts'

test('without any variable the corrector is off and safe defaults apply', () => {
  expect(readConfig({})).toEqual({
    apiKey: null,
    model: DEFAULT_MODEL,
    port: DEFAULT_PORT,
    ratePerMinute: 10,
    ratePerDay: 100,
    globalPerDay: 1000,
    maxOutputCorrect: 4000,
    maxOutputRun: 1500,
    timeoutMs: 30000,
    reasoningEffort: null,
    trustProxy: false,
    host: null,
  })
})

test('an empty or blank key means no key, so the corrector is off', () => {
  expect(readConfig({ OPENAI_API_KEY: '' }).apiKey).toBeNull()
  expect(readConfig({ OPENAI_API_KEY: '   ' }).apiKey).toBeNull()
})

test('variables are trimmed; invalid numbers fall back to the defaults', () => {
  const config = readConfig({
    OPENAI_API_KEY: '  test-key  ',
    OPENAI_MODEL: 'gpt-5-mini',
    PORT: '9000',
    RATE_PER_MINUTE: 'abc',
    RATE_PER_DAY: '-3',
    OPENAI_REASONING_EFFORT: 'low',
    TRUST_PROXY: '1',
  })
  expect(config).toMatchObject({ apiKey: 'test-key', model: 'gpt-5-mini', port: 9000, ratePerMinute: 10, ratePerDay: 100, reasoningEffort: 'low', trustProxy: true })
})

// The address the server listens on: every interface when unset (production); 127.0.0.1 for npm run dev.
test('the bind host is read from HOST, trimmed, unset when blank', () => {
  expect(readConfig({ HOST: ' 127.0.0.1 ' }).host).toBe('127.0.0.1')
  expect(readConfig({ HOST: '  ' }).host).toBeNull()
})
