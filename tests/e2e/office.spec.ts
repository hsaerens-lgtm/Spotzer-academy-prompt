import type { Page } from '@playwright/test'
import { expect, expectDialoguePhase, state, test } from './fixtures'

const EVIDENCE = 'docs/evidence/office'

async function openOffice(page: Page, hash = '') {
  // A hash-only change would not reload the page: go through a blank page to start fresh.
  await page.goto('about:blank')
  await page.goto(`/?phase=day${hash}`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
}

async function pressUntilVisible(page: Page, name: string) {
  const target = page.getByRole('button', { name })
  for (let i = 0; i < 40 && !(await target.isVisible()); i++) await page.keyboard.press('Space')
  await expect(target).toBeVisible()
}

const screenPosition = (page: Page, name: string) => page.evaluate((n) => window.__academy!.screenPosition!(n), name)

type Point = { x: number; y: number }

/**
 * Waits until a named 3D object stops moving on screen (two consecutive samples, at least one poll interval apart,
 * less than 1 px apart), i.e. until the camera, the rail easing and the parallax have settled. Returns its final position.
 * `previous` starts as null, so the first sample never counts as "settled" on its own.
 */
async function settledPosition(page: Page, name: string) {
  let previous = null as Point | null
  await expect
    .poll(
      async () => {
        const current = await screenPosition(page, name)
        const moved = previous && current ? Math.hypot(current.x - previous.x, current.y - previous.y) : Infinity
        previous = current
        return moved
      },
      { intervals: [200], timeout: 20_000 },
    )
    .toBeLessThan(1)
  return previous
}

test('scroll to the presentation view, learn a topic and keep the progress', async ({ page }) => {
  await openOffice(page)
  await expect(page.getByText('Scroll to take a seat')).toBeVisible()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${EVIDENCE}/01-overview.png` })

  await page.mouse.move(800, 300)
  await page.mouse.wheel(0, -1500)
  await expect.poll(async () => (await state(page)).railTarget).toBe(1)
  // The wheel also brings the camera back out to the overview.
  await page.mouse.wheel(0, 1500)
  await expect.poll(async () => (await state(page)).railTarget).toBe(0)
  await page.mouse.wheel(0, -1500)
  await expect.poll(async () => (await state(page)).railTarget).toBe(1)

  await page.getByRole('button', { name: /Learn the basics/ }).click()
  await page.getByRole('button', { name: /What is AI\?/ }).click()
  await expect(page.locator('.wall-screen [data-testid="screen-content"]')).toContainText('AI is a family of ideas')
  // Ada's first line is fully written and the camera is at rest: the screenshot is the same on every run.
  await expectDialoguePhase(page, 'waiting')
  await settledPosition(page, 'laptop')
  await page.screenshot({ path: `${EVIDENCE}/02-presentation.png` })

  await pressUntilVisible(page, 'Go deeper')
  await expect(page.getByTestId('progress')).toHaveText('1/13 topics')
  await page.getByRole('button', { name: 'Go deeper' }).click()
  await pressUntilVisible(page, 'All topics')
  await expect(page.getByRole('button', { name: 'Go deeper' })).toHaveCount(0)
  expect((await state(page)).progress.deeperSeen).toContain('what-is-ai')

  await page.reload()
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
  await expect(page.getByTestId('progress')).toHaveText('1/13 topics')
})

test('the real 3D laptop and the TV lead to their zones and back', async ({ page }) => {
  await openOffice(page)
  const approx = await settledPosition(page, 'laptop')
  expect(approx).not.toBeNull()
  // Moving the mouse shifts the view a little (parallax): let it settle, then aim again.
  await page.mouse.move(approx!.x, approx!.y)
  const laptop = await settledPosition(page, 'laptop')
  await page.mouse.move(laptop!.x, laptop!.y)
  await expect(page.locator('.object-label')).toHaveText('Prompt Workshop')
  await expect(page.locator('.stage canvas')).toHaveCSS('z-index', '2')
  await expect(page.locator('.stage canvas')).toHaveCSS('position', 'absolute')
  await page.screenshot({ path: `${EVIDENCE}/03-hover-laptop.png` })
  await page.mouse.click(laptop!.x, laptop!.y)
  await expect(page.getByRole('region', { name: /PROMPT_STUDIO\.EXE/ })).toBeVisible({ timeout: 30_000 })
  // The desktop fades in while Ada writes her first line: wait for both, so the picture is the same on every run.
  await expect(page.getByTestId('fader')).toHaveCSS('opacity', '0')
  await expect(page.locator('.ws-bubble__untyped')).toHaveCount(0)
  await page.screenshot({ path: `${EVIDENCE}/04-workshop.png` })
  await page.getByRole('button', { name: /Back to the office/ }).click()
  await expect.poll(async () => (await state(page)).zone).toBe('office')

  await page.evaluate(() => window.__academy!.clickObject('tv'))
  await expect(page.getByRole('heading', { name: 'The Dungeon' })).toBeVisible()
  // The screen fades in after the zone switch: wait for the fader to be fully off, so the picture is the same on every run.
  await expect(page.getByTestId('fader')).toHaveCSS('opacity', '0')
  await page.screenshot({ path: `${EVIDENCE}/10-dungeon-soon.png` })
  await page.goBack()
  await expect.poll(async () => (await state(page)).zone).toBe('office')
  await expect(page).toHaveURL(/#\/office$/)
})

test('everything works from the keyboard', async ({ page }) => {
  await openOffice(page)
  await page.keyboard.press('ArrowUp')
  await expect.poll(async () => (await state(page)).railTarget).toBe(0.25)

  // With nothing focused, activeElement is <body> and its textContent is the whole page: treat it as empty.
  const focusText = () =>
    page.evaluate(() => (document.activeElement === document.body ? '' : (document.activeElement?.textContent ?? '')))
  for (let i = 0; i < 15 && !(await focusText()).includes('Learn the basics'); i++) await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tablist')).toBeVisible()
  for (let i = 0; i < 25 && !(await focusText()).includes('What is AI?'); i++) await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('dialogue-line')).toBeVisible()
  // First Space finishes Ada's line, the second one moves on to the next beat.
  await expectDialoguePhase(page, 'typing')
  await page.keyboard.press('Space')
  await expectDialoguePhase(page, 'waiting')
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).dialogue?.beatIndex).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tablist')).toBeVisible()
  await page.keyboard.press('Escape')
  expect((await state(page)).menuOpen).toBe(false)
})

test('the wheel over a panel does not move the camera', async ({ page }) => {
  await openOffice(page)
  await page.getByRole('button', { name: /Learn the basics/ }).click()
  const menu = page.locator('.topic-menu')
  const box = (await menu.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 800)
  await page.waitForTimeout(300)
  expect((await state(page)).railTarget).toBe(1)
})

test('deep links open topics and bad links land on the office', async ({ page }) => {
  await openOffice(page, '#/office?topic=tokens')
  await expect(page.locator('.dialogue .at-kicker')).toHaveText('Tokens')
  await openOffice(page, '#/office?topic=nope')
  await expect(page.getByRole('button', { name: /Learn the basics/ })).toBeVisible()
  expect(await state(page)).toMatchObject({ zone: 'office', dialogue: null })
  await openOffice(page, '#/nowhere')
  await expect(page).toHaveURL(/#\/office$/)
})

// Spec 9, evidence: one wall-screen visual per chapter (chapters 1 and 2 are in the first journey and in 06).
const chapterVisuals = [
  { topic: 'prompt', title: 'Anatomy of a good prompt', file: '07-visual-prompt.png' },
  { topic: 'agents', title: 'The agent loop', file: '08-visual-agents.png' },
  { topic: 'ai-safety-at-work', title: 'The traffic light', file: '09-visual-ai-safety.png' },
]

for (const { topic, title, file } of chapterVisuals) {
  test(`deep link to "${topic}" shows its wall-screen visual`, async ({ page }) => {
    await openOffice(page, `#/office?topic=${topic}`)
    await expect(page.locator('.wall-screen [data-testid="screen-content"]')).toContainText(title)
    // Ada's first line is fully written and the camera is at rest: the screenshot is the same on every run.
    await expectDialoguePhase(page, 'waiting')
    await settledPosition(page, 'laptop')
    await page.screenshot({ path: `${EVIDENCE}/${file}` })
  })
}

// Spec 8.6: the minimum is a 1280 × 720 screen, whose browser viewport is only about 1280 × 600.
test.describe('smallest supported viewport (1280 × 600)', () => {
  // Set on the context, not with page.setViewportSize: that call also resets window.screen to the viewport size.
  test.use({ viewport: { width: 1280, height: 600 }, contextOptions: { screen: { width: 1280, height: 720 } } })

  test('the overview, a topic with its choices and the expanded view all fit', async ({ page }) => {
    await openOffice(page)
    // A 1280 × 720 screen is supported: no "larger screen" notice, even though the window is only 600 px tall.
    await expect(page.locator('.small-screen')).toHaveCount(0)
    await expect(page.getByText('Scroll to take a seat')).toBeVisible()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${EVIDENCE}/11-small-overview.png` })

    await page.mouse.move(640, 200)
    await page.mouse.wheel(0, -1500)
    await expect.poll(async () => (await state(page)).railTarget).toBe(1)
    await page.getByRole('button', { name: /Learn the basics/ }).click()
    await page.getByRole('button', { name: /What is AI\?/ }).click()
    await expect(page.locator('.wall-screen [data-testid="screen-content"]')).toContainText('AI is a family of ideas')
    await pressUntilVisible(page, 'Go deeper')
    await expectDialoguePhase(page, 'choices')
    await settledPosition(page, 'laptop')
    await page.screenshot({ path: `${EVIDENCE}/12-small-presentation.png` })

    const expand = page.getByRole('button', { name: 'Expand' })
    await expand.click()
    await expect(page.getByRole('dialog', { name: 'Expand' })).toBeVisible()
    // The HUD sits above the overlay in the stacking order: while the modal is open it must be inert.
    await expect(page.locator('.hud')).toHaveAttribute('inert', '')
    await expect(page.locator('.hud')).toHaveCSS('opacity', '0.4')
    await page.screenshot({ path: `${EVIDENCE}/13-small-expand.png` })
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog', { name: 'Expand' })).toHaveCount(0)
    await expect(page.locator('.hud')).not.toHaveAttribute('inert')
    await expect(expand).toBeFocused()
  })
})
