// @vitest-environment node

/** playwright.config.ts as Playwright would load it, with E2E_PORT set to `port` (or removed when undefined). */
async function loadConfig(port: string | undefined) {
  vi.resetModules()
  vi.stubEnv('E2E_PORT', port)
  return (await import('../../playwright.config')).default
}

afterEach(() => {
  vi.unstubAllEnvs()
})

test('the e2e server stays on port 5199 when E2E_PORT is not set', async () => {
  const config = await loadConfig(undefined)
  expect(config.use?.baseURL).toBe('http://localhost:5199')
  expect(config.webServer).toMatchObject({ command: 'npm run dev -- --port 5199 --strictPort', url: 'http://localhost:5199' })
})

test('an empty E2E_PORT falls back to 5199 too', async () => {
  const config = await loadConfig('')
  expect(config.use?.baseURL).toBe('http://localhost:5199')
  expect(config.webServer).toMatchObject({ command: 'npm run dev -- --port 5199 --strictPort', url: 'http://localhost:5199' })
})

test('E2E_PORT moves the base URL and the dev server together', async () => {
  const config = await loadConfig('5299')
  expect(config.use?.baseURL).toBe('http://localhost:5299')
  expect(config.webServer).toMatchObject({ command: 'npm run dev -- --port 5299 --strictPort', url: 'http://localhost:5299' })
})
