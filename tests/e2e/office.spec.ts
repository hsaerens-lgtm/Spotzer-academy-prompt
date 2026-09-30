import type { Page } from '@playwright/test'
import { expect, expectDialoguePhase, state, test } from './fixtures'

const EVIDENCE = 'docs/evidence/office'

async function openOffice(page: Page, hash = '') {
  // A hash-only change would not reload the page: go through a blank page to start fresh.
  await page.goto('about:blank')
  await page.goto(`/${hash}`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
}

async function pressUntilVisible(page: Page, name: string) {
  const target = page.getByRole('button', { name })
  for (let i = 0; i < 40 && !(await target.isVisible()); i++) await page.keyboard.press('Space')
  await expect(target).toBeVisible()
}

const screenPosition = (page: Page, name: string) => page.evaluate((n) => window.__academy!.screenPosition!(n), name)

/**
 * Waits until a named 3D object stops moving on screen (two consecutive samples less than 1 px apart),
 * i.e. until the camera, the rail easing and the parallax have settled. Returns its final position.
 */
async function settledPosition(page: Page, name: string) {
  let previous = await screenPosition(page, name)
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
  await expect(page.getByRole('heading', { name: 'Prompt Workshop' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/04-workshop-soon.png` })
  await page.getByRole('button', { name: /Back to the office/ }).click()
  await expect.poll(async () => (await state(page)).zone).toBe('office')

  await page.evaluate(() => window.__academy!.clickObject('tv'))
  await expect(page.getByRole('heading', { name: 'The Dungeon' })).toBeVisible()
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
