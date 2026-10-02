import { expect, expectDialoguePhase, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null
      return (original as (...params: unknown[]) => RenderingContext | null).call(this, type, ...args)
    } as typeof original
  })
})

test('without WebGL the site opens in reading mode and the tokens demo works', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Reading mode' })).toBeVisible()
  await expect(page.getByTestId('stage')).toHaveCount(0)

  await page.getByRole('tab', { name: /How it works/ }).click()
  await page.getByRole('button', { name: /^Tokens/ }).click()
  await expect(page.getByTestId('screen-content')).toContainText('AI reads in chunks')
  // Ada's first line is fully written: the screenshot is the same on every run.
  await expectDialoguePhase(page, 'waiting')
  await page.screenshot({ path: 'docs/evidence/office/05-reading-mode.png' })

  await page.getByRole('button', { name: 'Try it yourself' }).click()
  const box = page.getByRole('textbox', { name: 'Type a sentence' })
  await expect(page.getByText('9 tokens · 35 characters').last()).toBeVisible()
  await box.fill('Hello world')
  await expect(page.getByText(/tokens · 11 characters/)).toBeVisible()
  await page.screenshot({ path: 'docs/evidence/office/06-tokens-demo.png' })
})

// Spec 8.6: the minimum is a 1280 × 720 screen, whose browser viewport is only about 1280 × 600.
test.describe('smallest supported viewport (1280 × 600)', () => {
  // Set on the context, not with page.setViewportSize: that call also resets window.screen to the viewport size.
  test.use({ viewport: { width: 1280, height: 600 }, contextOptions: { screen: { width: 1280, height: 720 } } })

  test('reading mode fits and shows no larger-screen notice', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('main', { name: 'Reading mode' })).toBeVisible()
    await expect(page.locator('.small-screen')).toHaveCount(0)
    await page.getByRole('tab', { name: /How it works/ }).click()
    await page.getByRole('button', { name: /^Tokens/ }).click()
    await expect(page.getByTestId('screen-content')).toContainText('AI reads in chunks')
    await expectDialoguePhase(page, 'waiting')
    await page.screenshot({ path: 'docs/evidence/office/14-small-reading.png' })
  })
})
