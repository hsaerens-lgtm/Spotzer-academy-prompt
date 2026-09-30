import { expect, test, type Page } from '@playwright/test'

const EVIDENCE = 'docs/evidence/office'

async function openOffice(page: Page, hash = '') {
  // A hash-only change would not reload the page: go through a blank page to start fresh.
  await page.goto('about:blank')
  await page.goto(`/${hash}`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
}

const state = (page: Page) => page.evaluate(() => window.__academy!.state())

async function pressUntilVisible(page: Page, name: string) {
  const target = page.getByRole('button', { name })
  for (let i = 0; i < 40 && !(await target.isVisible()); i++) await page.keyboard.press('Space')
  await expect(target).toBeVisible()
}

test('scroll to the presentation view, learn a topic and keep the progress', async ({ page }) => {
  await openOffice(page)
  await expect(page.getByText('Scroll to take a seat')).toBeVisible()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${EVIDENCE}/01-overview.png` })

  await page.mouse.move(800, 300)
  await page.mouse.wheel(0, -1500)
  await expect.poll(async () => (await state(page)).railTarget).toBe(1)

  await page.getByRole('button', { name: /Learn the basics/ }).click()
  await page.getByRole('button', { name: /What is AI\?/ }).click()
  await expect(page.locator('.wall-screen [data-testid="screen-content"]')).toContainText('AI is a family of ideas')
  await page.waitForTimeout(1500)
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
  await page.waitForTimeout(1500)
  const approx = await page.evaluate(() => window.__academy!.screenPosition!('laptop'))
  expect(approx).not.toBeNull()
  // Moving the mouse shifts the view a little (parallax): let it settle, then aim again.
  await page.mouse.move(approx!.x, approx!.y)
  await page.waitForTimeout(1200)
  const laptop = await page.evaluate(() => window.__academy!.screenPosition!('laptop'))
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
  expect(new URL(page.url()).hash).toBe('#/office')
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
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  expect((await state(page)).dialogue?.beatIndex).toBe(1)
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
  await openOffice(page, '#/nowhere')
  expect(new URL(page.url()).hash).toBe('#/office')
})
