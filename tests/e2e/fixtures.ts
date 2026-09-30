import { expect, test as base, type Page } from '@playwright/test'

/** `test` with an automatic check: no uncaught page error (pageerror) may happen during a test. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await use(errors)
      expect(errors, 'uncaught page errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export const state = (page: Page) => page.evaluate(() => window.__academy!.state())

/** Waits for the dialogue engine phase: 'typing' while Ada's line is written, 'waiting' once it is complete. */
export async function expectDialoguePhase(page: Page, phase: 'typing' | 'waiting' | 'choices') {
  await expect.poll(async () => (await state(page)).dialogue?.phase).toBe(phase)
}
