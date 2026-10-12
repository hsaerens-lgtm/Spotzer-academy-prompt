import { defineConfig, devices } from '@playwright/test'

// Another worktree can run its own e2e on 5199 at the same time: set E2E_PORT to use a different port (empty means unset).
const port = process.env.E2E_PORT || '5199'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    // A variable already set wins over .env.local: an empty key keeps the corrector off, so e2e never calls OpenAI.
    env: { OPENAI_API_KEY: '' },
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
