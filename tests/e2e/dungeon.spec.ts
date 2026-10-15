import type { Page } from '@playwright/test'
import { expect, state, test } from './fixtures'

const EVIDENCE = 'docs/evidence/dungeon'
/** The "excellent" sample of floor 1's boss (content/en/dungeon/bosses.json). */
const BOSS_1 =
  "You are a web copywriter. Write an About us page for Martin's Bakery, a family bakery in Ghent that has baked sourdough bread since 1987. It is open Tuesday to Sunday. Tone: warm and personal. Shape: a short intro and three paragraphs, about 200 words."

interface Run {
  phase: string
  current: number | null
  hearts: number
}

async function openDungeon(page: Page, query = '') {
  // A hash-only change would not reload the page: go through a blank page to start fresh.
  await page.goto('about:blank')
  await page.goto(`/#/dungeon${query}`)
  await expect(page.getByRole('heading', { name: 'THE DUNGEON' }).or(page.getByTestId('dungeon'))).toBeVisible({ timeout: 60_000 })
}
const run = (page: Page) => page.evaluate(() => window.__academy!.dungeon!() as Run)

/** Steps in front of the next guardian (test hook), answers right or wrong, and closes the answer. */
async function guardian(page: Page, correct: boolean) {
  await page.evaluate(() => window.__academy!.dungeonAdvance!())
  await expect.poll(async () => (await run(page)).phase).toBe('encounter')
  await page.evaluate((right) => window.__academy!.dungeonAnswer!(right), correct)
  await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()
}

test('from the office TV to a passed floor 1, with the PDF certificate', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
  await page.getByRole('button', { name: 'The dungeon' }).click()
  await expect(page.getByRole('heading', { name: 'THE DUNGEON' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('fader')).toHaveCSS('opacity', '0')
  await page.screenshot({ path: `${EVIDENCE}/01-title.png` })
  await page.getByRole('button', { name: 'Enter anyway' }).click()
  await expect(page.getByTestId('dungeon')).toBeVisible()
  await expect(page.locator('.dg-canvas canvas')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${EVIDENCE}/02-corridor.png` })
  for (let i = 0; i < 13; i++) {
    if (i === 3) {
      await page.evaluate(() => window.__academy!.dungeonAdvance!())
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.screenshot({ path: `${EVIDENCE}/03-guardian.png` })
      await page.evaluate(() => window.__academy!.dungeonAnswer!(true))
      await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click()
      continue
    }
    // One mistake on the way: the score shows it.
    await guardian(page, i !== 5)
  }
  await page.evaluate(() => window.__academy!.dungeonAdvance!())
  await page.getByRole('textbox', { name: 'Your prompt' }).fill(BOSS_1)
  await page.screenshot({ path: `${EVIDENCE}/04-boss.png` })
  await page.getByRole('button', { name: 'Test my prompt' }).click()
  // The heading, not the live region that says the same words.
  await expect(page.getByRole('heading', { name: 'You beat the dungeon!' })).toBeVisible()
  await expect(page.locator('.dg-score')).toHaveText('Score 95/100')
  expect((await state(page)).progress.dungeon?.passed).toBe(true)
  await page.getByRole('textbox', { name: 'Your name' }).fill('Zoë Martin')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  expect((await download).suggestedFilename()).toBe('athena-prompt-academy-certificate.pdf')
  await page.screenshot({ path: `${EVIDENCE}/05-victory.png` })
})

test("three wrong answers eject to the office, where Ada's debrief opens a missed topic", async ({ page }) => {
  await openDungeon(page, '?floor=1')
  for (let i = 0; i < 3; i++) await guardian(page, false)
  await expect(page.getByRole('heading', { name: 'GAME OVER' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/06-game-over.png` })
  await page.getByRole('button', { name: 'Back to the office' }).click()
  await expect(page.getByText(/The guardians caught you on What is AI\?/)).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${EVIDENCE}/07-debrief.png` })
  await page.getByRole('button', { name: 'What is AI?' }).click()
  await expect.poll(async () => (await state(page)).activeTopic).toBe('what-is-ai')
})

test('the expert floor opens after floor 1 and ends on the corrections', async ({ page }) => {
  await page.addInitScript(() => {
    // Also runs in about:blank, which has no storage.
    if (window.location.protocol !== 'http:') return
    const progress = { version: 1, topicsSeen: [], deeperSeen: [], workshopDone: false, dungeon: { passed: true, bestScore: 80, passedAt: '2026-10-15' }, firstVisitDone: true }
    window.localStorage.setItem('athena-prompt-academy:v1', JSON.stringify(progress))
  })
  await openDungeon(page)
  await page.getByRole('button', { name: /Floor 2/ }).click()
  await expect(page.locator('.dg-game--floor2')).toBeVisible()
  await expect(page.locator('.dg-canvas canvas')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${EVIDENCE}/08-the-deep.png` })
  await guardian(page, false)
  await guardian(page, false)
  await expect(page.getByRole('heading', { name: 'GAME OVER' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Corrections' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/09-corrections.png` })
})

test('in reading mode the dungeon is a text adventure', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Reading mode' }).click()
  await page.getByRole('main', { name: 'Reading mode' }).getByRole('button', { name: 'The dungeon' }).click()
  await page.getByRole('button', { name: 'Enter anyway' }).click()
  await expect(page.getByText('A narrow corridor. Torches flicker.')).toBeVisible()
  await expect(page.locator('.dg-canvas canvas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('dialog', { name: 'The Gatekeeper' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/10-text.png` })
})

test.describe('smallest supported viewport (1280 x 600)', () => {
  test.use({ viewport: { width: 1280, height: 600 }, contextOptions: { screen: { width: 1280, height: 720 } } })
  test('the title screen, the HUD and a dialog fit', async ({ page }) => {
    await openDungeon(page)
    const enter = (await page.getByRole('button', { name: 'Enter anyway' }).boundingBox())!
    expect(enter.y + enter.height).toBeLessThanOrEqual(600)
    await page.getByRole('button', { name: 'Enter anyway' }).click()
    await page.evaluate(() => window.__academy!.dungeonAdvance!())
    const box = (await page.getByRole('dialog').boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(600)
    await page.screenshot({ path: `${EVIDENCE}/11-small.png` })
  })
})

// Final review, finding 17 (spec 3, §7): without WebGL the dungeon switches to the text adventure.
test('without WebGL the dungeon is a text adventure', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null
      return (original as (...params: unknown[]) => RenderingContext | null).call(this, type, ...args)
    } as typeof original
  })
  await openDungeon(page, '?floor=1')
  await expect(page.getByText('A narrow corridor. Torches flicker.')).toBeVisible()
  await expect(page.locator('.dg-canvas canvas')).toHaveCount(0)
})

// Final review, finding 1: the old canvas's disposal loses its context on purpose; the next run must still be in 3D.
test('back to the title screen and in again: the next run is still in 3D', async ({ page }) => {
  await openDungeon(page, '?floor=1')
  await expect(page.locator('.dg-canvas canvas')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Back to the title screen' }).click()
  await page.getByRole('button', { name: 'Leave' }).click()
  await expect(page.getByRole('heading', { name: 'THE DUNGEON' })).toBeVisible()
  // Long enough for the old renderer to be disposed (and its context lost).
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Enter anyway' }).click()
  await expect(page.locator('.dg-canvas canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('A narrow corridor. Torches flicker.')).toHaveCount(0)
  await expect(page.getByTestId('dungeon-announcer')).not.toContainText('3D view stopped')
})
