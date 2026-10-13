import type { Page } from '@playwright/test'
import { expect, state, test } from './fixtures'

const EVIDENCE = 'docs/evidence/workshop'
const STUDIO_1 = 'PROMPT_STUDIO.EXE \u2014 MISSION 1'

async function openWorkshop(page: Page, query = '') {
  // A hash-only change would not reload the page: go through a blank page to start fresh.
  await page.goto('about:blank')
  await page.goto(`/#/workshop${query}`)
  await expect(page.getByRole('navigation', { name: 'Taskbar' })).toBeVisible({ timeout: 60_000 })
}

async function openOffice(page: Page) {
  await page.goto('about:blank')
  await page.goto('/')
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
}

/** Build & test, skip the 3D animation when it runs, and wait for the answer. */
async function buildAndWait(page: Page, tier: string) {
  await page.getByRole('button', { name: 'Build & test' }).click()
  const skip = page.getByRole('button', { name: 'Skip' })
  await skip.click({ timeout: 15_000 }).catch(() => {})
  await expect(page.getByRole('region', { name: 'AI_OUTPUT.TXT' }).getByText(tier)).toBeVisible({ timeout: 30_000 })
}

async function fill(page: Page, name: string, value: string) {
  const field = page.getByRole('textbox', { name })
  await field.fill(value)
}

/** Ada has written her whole line (the rest of a line being typed holds its place, hidden): the picture is final. */
async function adaDone(page: Page) {
  await expect(page.locator('.ws-bubble__untyped')).toHaveCount(0, { timeout: 15_000 })
}

/** Where the focus is: its area (a window's title, Ada or the taskbar) and the control's name. */
const focusStop = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement
    if (!element || element === document.body) return { area: '', name: '' }
    const area = element.closest('section[aria-labelledby], aside[aria-label], nav[aria-label="Taskbar"], [role="group"][aria-label]')
    const titleId = area?.getAttribute('aria-labelledby')
    return {
      area: (titleId ? document.getElementById(titleId)?.textContent : area?.getAttribute('aria-label')) ?? '',
      name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
    }
  })

/**
 * Presses `key` until the focus lands on the control named `name`; returns the areas the focus went through, in order,
 * starting with the one it was in.
 */
async function tabTo(page: Page, name: string, key: 'Tab' | 'Shift+Tab' = 'Tab') {
  const start = await focusStop(page)
  const areas: string[] = start.area ? [start.area] : []
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(key)
    const stop = await focusStop(page)
    if (stop.area && areas.at(-1) !== stop.area) areas.push(stop.area)
    if (stop.name === name) return areas
  }
  throw new Error(`No focus stop named "${name}" (went through ${areas.join(' > ')})`)
}

/** Replaces the text of the focused field from the keyboard. */
async function typeOver(page: Page, text: string) {
  await page.keyboard.press('Control+A')
  await page.keyboard.type(text)
}

const report = {
  score: 62,
  verdict: 'leans',
  summary: 'Your foundation and ground floor hold, but the context floor is thin, so the building leans.',
  blocks: [
    { type: 'role', quality: 3, quote: 'You are a copywriter', good: 'A clear job.', missing: '' },
    { type: 'task', quality: 3, quote: 'Write a post', good: 'A clear task.', missing: '' },
    { type: 'context', quality: 1, quote: 'for a shop', good: 'Some context.', missing: 'Which shop, which offer?' },
    { type: 'format', quality: 2, quote: 'short', good: 'A length.', missing: 'No tone.' },
    { type: 'example', quality: 0, quote: null, good: '', missing: 'No example.' },
    { type: 'constraint', quality: 0, quote: null, good: '', missing: 'No rule.' },
  ],
  conflicts: [],
  improvedPrompt: 'You are a copywriter. Write a short, warm Instagram post for [shop name] about [the offer], ending with a call to action.',
  changes: ['Named the platform', 'Added placeholders for the facts', 'Added a tone and a call to action'],
}

/**
 * The corrector's server, simulated: nothing reaches the real proxy (nor OpenAI). Registered first, the catch-all
 * answers any other /api call; the routes given after it win over it.
 */
async function simulateServer(page: Page, online: boolean) {
  await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: { error: 'unavailable' } }))
  await page.route('**/api/health', (route) => route.fulfill({ json: { corrector: online } }))
  if (!online) return
  await page.route('**/api/correct', (route) => route.fulfill({ json: report }))
  await page.route('**/api/run', async (route) => {
    const { prompt } = route.request().postDataJSON() as { prompt: string }
    await route.fulfill({ json: { answer: prompt.startsWith('You are a copywriter. Write a short') ? 'An improved post.' : 'A generic post.' } })
  })
}

test('from the office laptop to a passed first mission, and back with the counter', async ({ page }) => {
  await openOffice(page)
  await page.getByRole('button', { name: 'Prompt workshop' }).click()
  await expect(page.getByRole('region', { name: STUDIO_1 })).toBeVisible({ timeout: 30_000 })

  await fill(page, 'Role block', 'An account manager at a web agency')
  await fill(page, 'Task block', 'Write an email to the client')
  await fill(page, 'Context block', 'The website is late')
  await fill(page, 'Format block', 'Friendly')
  await buildAndWait(page, 'LEANING \u00B7 PASSABLE')
  // Passable is not a pass: no tick, no counter, nothing saved.
  await expect(page.getByRole('navigation', { name: 'Taskbar' }).getByText('0/6 missions')).toBeVisible()
  await adaDone(page)
  await page.screenshot({ path: `${EVIDENCE}/01-mission-leans.png` })

  await fill(page, 'Context block', "The client is Martin's Bakery. The launch moves to next Friday because the photos arrived late.")
  await fill(page, 'Format block', 'Friendly and apologetic, under 120 words')
  await buildAndWait(page, 'HOLDS \u00B7 EXCELLENT')
  await expect(page.getByRole('navigation', { name: 'Taskbar' }).getByText('1/6 missions')).toBeVisible()
  // The studio's mission picker counts it too, and ticks it in its list.
  const picker = page.getByRole('region', { name: STUDIO_1 }).getByRole('button', { name: 'All missions 1/6' })
  await picker.click()
  await expect(page.getByRole('navigation', { name: 'Missions' }).getByRole('button', { name: 'The delayed website (passed)' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Missions' })).toHaveCount(0)
  expect((await state(page)).progress.workshop?.passed).toEqual(['delayed-website'])
  await adaDone(page)
  await page.screenshot({ path: `${EVIDENCE}/02-mission-holds.png` })

  // Spec 3.8: Before / After puts the first attempt and the passed one side by side.
  const compare = page.getByRole('complementary', { name: 'Ada' }).getByRole('button', { name: 'Before / After' })
  await compare.click()
  await expect(compare).toHaveAttribute('aria-pressed', 'true')
  const output = page.getByRole('region', { name: 'AI_OUTPUT.TXT' })
  await expect(output.getByRole('heading', { name: 'Before' })).toBeVisible()
  await expect(output.getByRole('heading', { name: 'After' })).toBeVisible()
  await expect(output.getByText('LEANING \u00B7 PASSABLE')).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/09-before-after.png` })

  await page.getByRole('navigation', { name: 'Taskbar' }).getByRole('button', { name: 'My prompts' }).click()
  await expect(page.getByRole('region', { name: 'MY_PROMPTS.TXT' }).getByText(/Role: An account manager/)).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/08-my-prompts.png` })

  await page.getByRole('navigation', { name: 'Taskbar' }).getByRole('button', { name: 'Back to the office' }).click()
  await expect(page.getByRole('button', { name: 'Prompt workshop \u00B7 1/6' })).toBeVisible({ timeout: 30_000 })
})

// Task 15 note: in a real browser, entering the workshop is one history entry; nothing inside it adds another, so Back
// from any mission or program returns to the office.
test('the browser history: one entry into the workshop, none inside it, Back lands on the office', async ({ page }) => {
  const entries = () => page.evaluate(() => window.history.length)
  const zone = async () => (await state(page)).zone
  await openOffice(page)
  const before = await entries()

  await page.getByRole('button', { name: 'Prompt workshop' }).click()
  await expect(page.getByRole('region', { name: STUDIO_1 })).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/#\/workshop\?mission=delayed-website$/)
  expect(await entries()).toBe(before + 1)

  await page.getByRole('region', { name: STUDIO_1 }).getByRole('button', { name: /All missions/ }).click()
  await page.getByRole('navigation', { name: 'Missions' }).getByRole('button', { name: 'A post for a florist' }).click()
  await expect(page).toHaveURL(/#\/workshop\?mission=florist-post$/)
  const taskbar = page.getByRole('navigation', { name: 'Taskbar' })
  await taskbar.getByRole('button', { name: 'My prompts' }).click()
  await expect(page).toHaveURL(/#\/workshop\?app=prompts$/)
  await taskbar.getByRole('button', { name: 'Missions' }).click()
  await expect(page).toHaveURL(/#\/workshop\?mission=florist-post$/)
  expect(await entries()).toBe(before + 1)

  await page.goBack()
  await expect.poll(zone, { timeout: 30_000 }).toBe('office')
  await expect(page).toHaveURL(/#\/office$/)

  // A link to a mission that does not exist opens the suggested one in place: the browser's own entry for the link is
  // the only one, and Back still leaves the workshop.
  await page.evaluate(() => {
    window.location.hash = '#/workshop?mission=ghost'
  })
  await expect(page.getByRole('region', { name: STUDIO_1 })).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/#\/workshop\?mission=delayed-website$/)
  expect(await entries()).toBe(before + 1)
  await page.goBack()
  await expect.poll(zone, { timeout: 30_000 }).toBe('office')
  await expect(page).toHaveURL(/#\/office$/)
})

test('a fix mission starts collapsed and holds once fixed', async ({ page }) => {
  await openWorkshop(page, '?mission=plumber-services')
  // Spec 3.6: the building already stands collapsed as the mission opens; it is not built up first, so nothing to skip.
  const builder = page.getByRole('region', { name: 'BUILDER.EXE' })
  expect(await builder.getByRole('button', { name: 'Skip' }).count()).toBe(0)
  await expect(builder.getByRole('meter', { name: 'Stability' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'AI_OUTPUT.TXT' }).getByText('COLLAPSED \u00B7 VAGUE')).toBeVisible()
  await adaDone(page)
  await page.screenshot({ path: `${EVIDENCE}/03-fix-collapsed.png` })
  await fill(
    page,
    'Your prompt',
    "You are a web copywriter. Write a Services page for Bram's Plumbing, a local plumber in Utrecht. Services: emergency repairs 24/7, boiler installation and servicing, leak detection, bathroom renovations. Tone: trustworthy and clear. Shape: a short intro, then one section per service, about 150 words.",
  )
  await buildAndWait(page, 'HOLDS \u00B7 EXCELLENT')
})

test('in free text Ada points at the missing role after a pause', async ({ page }) => {
  await openWorkshop(page, '?mission=florist-post')
  await fill(page, 'Your prompt', "Write an Instagram post for Rosa's Flowers about the Mother's Day discount")
  await expect(page.getByRole('complementary', { name: 'Ada' }).getByText(/It looks like you're writing a prompt!/).first()).toBeVisible({
    timeout: 10_000,
  })
  await adaDone(page)
  await page.screenshot({ path: `${EVIDENCE}/04-free-text-tip.png` })
})

test('the corrector reports, improves and runs both prompts (server answers simulated)', async ({ page }) => {
  await simulateServer(page, true)
  await openWorkshop(page, '?app=corrector')
  const corrector = page.getByRole('region', { name: 'CORRECTOR.EXE' })
  await corrector.getByRole('textbox', { name: 'Paste or write any prompt' }).fill('You are a copywriter. Write a post for a shop, short.')
  await corrector.getByRole('button', { name: 'Check my prompt' }).click()
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 15_000 }).catch(() => {})
  await expect(corrector.getByText('62/100 \u00B7 Leans')).toBeVisible({ timeout: 30_000 })
  const panel = page.getByRole('region', { name: 'AI_OUTPUT.TXT' })
  await panel.getByRole('button', { name: 'Run both' }).click()
  await expect(panel.getByText('An improved post.')).toBeVisible()
  await expect(panel.getByText('A generic post.')).toBeVisible()
  // Spec 3.9 step 3: the improved prompt, its additions highlighted, is what the picture shows, from its heading down.
  // Only the window's own body scrolls (scrollIntoView would also move the desktop, whose overflow is hidden).
  await panel.getByRole('heading', { name: 'Improved prompt', exact: true }).evaluate((heading) => {
    const body = heading.closest('.ws-window__body')!
    body.scrollTop += heading.getBoundingClientRect().top - body.getBoundingClientRect().top
  })
  const improved = panel.locator('.ws-improved')
  await expect(improved).toHaveText(report.improvedPrompt)
  await expect(improved.locator('ins').first()).toBeVisible()
  await expect(improved).toBeInViewport()
  await adaDone(page)
  await page.screenshot({ path: `${EVIDENCE}/05-corrector.png` })
})

test('the corrector says it is offline without the server', async ({ page }) => {
  await simulateServer(page, false)
  await openWorkshop(page, '?app=corrector')
  await expect(page.getByRole('region', { name: 'CORRECTOR.EXE' }).getByText('The corrector is offline.')).toBeVisible()
  // There is no Check my prompt button offline: the builder does not point at one.
  await expect(page.getByRole('region', { name: 'BUILDER.EXE' })).toHaveText(/The corrector is offline, so there is no building to inspect\./)
})

test('without WebGL the workshop shows the plan view', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null
      return (original as (...params: unknown[]) => RenderingContext | null).call(this, type, ...args)
    } as typeof original
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Prompt workshop' }).click()
  await expect(page.getByRole('region', { name: STUDIO_1 })).toBeVisible({ timeout: 30_000 })
  await fill(page, 'Task block', 'Write an email')
  await page.getByRole('button', { name: 'Build & test' }).click()
  await expect(page.getByRole('list', { name: /Plan view/ })).toBeVisible()
  await adaDone(page)
  await page.screenshot({ path: `${EVIDENCE}/06-plan-view.png` })
})

// Spec 4.8: in reading mode the workshop works in full, with the plan view instead of the 3D builder.
test('from reading mode the workshop builds in plan view', async ({ page }) => {
  await openOffice(page)
  await page.getByRole('button', { name: 'Reading mode' }).click()
  await expect(page.getByRole('main', { name: 'Reading mode' })).toBeVisible()
  await page.getByRole('button', { name: 'Prompt workshop' }).click()
  await expect(page.getByRole('region', { name: STUDIO_1 })).toBeVisible({ timeout: 30_000 })
  await fill(page, 'Task block', 'Write an email')
  await page.getByRole('button', { name: 'Build & test' }).click()
  const builder = page.getByRole('region', { name: 'BUILDER.EXE' })
  await expect(builder.getByRole('list', { name: /Plan view/ })).toBeVisible()
  await expect(builder.locator('canvas')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'AI_OUTPUT.TXT' }).getByText('COLLAPSED \u00B7 VAGUE')).toBeVisible()
})

// Spec 1, criterion 7, and 6.3: a whole mission from the keyboard alone, through the windows in their order
// (missions, editor, builder, output, Ada), with every result announced.
test('a whole mission works from the keyboard alone, and its results are announced', async ({ page }) => {
  const announcer = page.getByTestId('workshop-announcer')
  await openWorkshop(page)

  // From the start of the page to the first block: the studio's mission picker, then the editor.
  expect(await tabTo(page, 'Role block')).toEqual([STUDIO_1])
  await page.keyboard.press('Tab')
  await page.keyboard.type('Write an email')
  await page.keyboard.press('Control+Enter')
  // The editor's buttons, then the builder's.
  expect(await tabTo(page, 'Skip')).toEqual([STUDIO_1, 'BUILDER.EXE'])
  await page.keyboard.press('Enter')
  await expect(announcer).toHaveText(/^COLLAPSED \u00B7 VAGUE\. There's a hole in the building: the Role block is missing\./, { timeout: 30_000 })
  // The answer is short and has nothing to operate: the builder hands over to Ada.
  expect(await tabTo(page, 'Edit my prompt')).toEqual(['BUILDER.EXE', 'Ada'])
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Role block' })).toBeFocused()

  await page.keyboard.type('An account manager at a web agency')
  await page.keyboard.press('Tab')
  await typeOver(page, 'Write an email to the client')
  await page.keyboard.press('Tab')
  await page.keyboard.type("The client is Martin's Bakery. The launch moves to next Friday because the photos arrived late.")
  await page.keyboard.press('Tab')
  await page.keyboard.type('Friendly and apologetic, under 120 words')
  await page.keyboard.press('Control+Enter')
  await tabTo(page, 'Skip')
  await page.keyboard.press('Enter')
  await expect(announcer).toHaveText(/^HOLDS \u00B7 EXCELLENT\. It holds!/, { timeout: 30_000 })
  // The email is longer than its window: the answer scrolls, so it takes the focus between the builder and Ada.
  expect(await tabTo(page, 'Before / After')).toEqual(['BUILDER.EXE', 'AI_OUTPUT.TXT', 'Ada'])
  await page.keyboard.press('Space')
  await expect(page.getByRole('region', { name: 'AI_OUTPUT.TXT' }).getByRole('heading', { name: 'Before' })).toBeVisible()

  // Next mission: its first editor takes the focus.
  await tabTo(page, 'Next mission', 'Shift+Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'PROMPT_STUDIO.EXE \u2014 MISSION 2' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Role block' })).toBeFocused()
})

// Spec 6.3: the focus ring shows on every control, including those in the lime title bar of the active program.
test("the builder's title-bar buttons show a focus ring that stands out from the lime bar", async ({ page }) => {
  await openWorkshop(page)
  await fill(page, 'Task block', 'Write an email')
  await page.keyboard.press('Control+Enter')
  /** The focused control's ring and the background of the title bar it sits on. */
  const ring = () =>
    page.evaluate(() => {
      const element = document.activeElement as HTMLElement
      const style = getComputedStyle(element)
      return { style: style.outlineStyle, color: style.outlineColor, bar: getComputedStyle(element.closest('.ws-window__bar')!).backgroundColor }
    })
  await tabTo(page, 'Skip')
  const skip = await ring()
  expect(skip.style).toBe('solid')
  expect(skip.color).not.toBe(skip.bar)
  await tabTo(page, 'Reset view')
  const reset = await ring()
  expect(reset.style).toBe('solid')
  expect(reset.color).not.toBe(reset.bar)

  // Once the building stands still (Skip gone), the ring is the only difference between the focused and the blurred bar.
  const builder = page.getByRole('region', { name: 'BUILDER.EXE' })
  await expect(builder.getByRole('button', { name: 'Skip' })).toHaveCount(0, { timeout: 30_000 })
  await expect(builder.getByRole('button', { name: 'Reset view' })).toBeFocused()
  const bar = builder.locator('.ws-window__bar')
  const focused = await bar.screenshot()
  await page.evaluate(() => (document.activeElement as HTMLElement).blur())
  const blurred = await bar.screenshot()
  expect(focused.equals(blurred)).toBe(false)
})

test.describe('smallest supported viewport (1280 x 600)', () => {
  // Set on the context, not with page.setViewportSize: that call also resets window.screen to the viewport size.
  test.use({ viewport: { width: 1280, height: 600 }, contextOptions: { screen: { width: 1280, height: 720 } } })
  test('the missions view fits', async ({ page }) => {
    await openWorkshop(page)
    await fill(page, 'Task block', 'Write an email')
    await buildAndWait(page, 'COLLAPSED \u00B7 VAGUE')
    await adaDone(page)
    await page.screenshot({ path: `${EVIDENCE}/07-small-screen.png` })
    for (const name of [STUDIO_1, 'BUILDER.EXE', 'AI_OUTPUT.TXT']) {
      const box = await page.getByRole('region', { name }).boundingBox()
      expect(box && box.y + box.height).toBeLessThanOrEqual(600)
    }
  })
})

// Task 15 residual: Ada's last congratulations (success, takeaway, bonus and the pointer to the office console: the
// longest is this mission's, 366 characters) must show in full, without scrolling inside her bubble.
const lastMission = {
  others: ['delayed-website', 'meeting-notes', 'florist-post', 'support-hours', 'newsletter'],
  text: "You are a web copywriter. Write a Services page for Bram's Plumbing, a local plumber in Utrecht. Services: emergency repairs 24/7, boiler installation and servicing, leak detection, bathroom renovations. Tone: trustworthy and clear. Shape: a short intro, then one section per service, about 150 words. Don't invent prices.",
}

async function passLastMission(page: Page) {
  await page.addInitScript((passed) => {
    // Also runs in about:blank, which has no storage.
    if (window.location.protocol !== 'http:') return
    const progress = { version: 1, topicsSeen: [], deeperSeen: [], workshopDone: false, dungeon: null, firstVisitDone: true, workshop: { passed, prompts: {} } }
    window.localStorage.setItem('athena-prompt-academy:v1', JSON.stringify(progress))
  }, lastMission.others)
  await openWorkshop(page, '?mission=plumber-services')
  await fill(page, 'Your prompt', lastMission.text)
  await buildAndWait(page, 'HOLDS \u00B7 EXCELLENT')
  expect((await state(page)).progress.workshopDone).toBe(true)
  const bubble = page.getByRole('complementary', { name: 'Ada' }).locator('.ws-bubble__text')
  await expect(bubble).toContainText("All six missions done! When you're ready, the old console in the office will test what you've learned.")
  await adaDone(page)
  const overflow = await bubble.evaluate((element) => element.scrollHeight - element.clientHeight)
  expect(overflow).toBeLessThanOrEqual(0)
  // Her row is under the output window: the bubble covers no window.
  const ada = (await page.getByRole('complementary', { name: 'Ada' }).boundingBox())!
  const output = (await page.getByRole('region', { name: 'AI_OUTPUT.TXT' }).boundingBox())!
  expect(ada.y).toBeGreaterThanOrEqual(output.y + output.height)
}

test('all six missions passed: Ada says it all, in full', async ({ page }) => {
  await passLastMission(page)
  await page.screenshot({ path: `${EVIDENCE}/10-all-done.png` })
})

test.describe('all six missions passed, smallest supported viewport (1280 x 600)', () => {
  test.use({ viewport: { width: 1280, height: 600 }, contextOptions: { screen: { width: 1280, height: 720 } } })
  test('Ada says it all, in full', async ({ page }) => {
    await passLastMission(page)
    await page.screenshot({ path: `${EVIDENCE}/11-small-all-done.png` })
    for (const name of ['PROMPT_STUDIO.EXE \u2014 MISSION 5', 'BUILDER.EXE', 'AI_OUTPUT.TXT']) {
      const box = await page.getByRole('region', { name }).boundingBox()
      expect(box && box.y + box.height).toBeLessThanOrEqual(600)
    }
  })
})

// The lesson of a passed mission before the last one (success, takeaway and the bonus line: 262 characters for this
// one) shows in full too, without scrolling inside Ada's bubble: a long line gives her row more room, and every window
// stays on the screen.
async function passWithBonus(page: Page) {
  await openWorkshop(page, '?mission=plumber-services')
  await fill(page, 'Your prompt', lastMission.text)
  await buildAndWait(page, 'HOLDS · EXCELLENT')
  expect((await state(page)).progress.workshopDone).toBe(false)
  const ada = page.getByRole('complementary', { name: 'Ada' })
  const bubble = ada.locator('.ws-bubble__text')
  await expect(bubble).toContainText('Bonus points: your extra blocks reinforce the building.')
  await adaDone(page)
  expect(await bubble.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0)
  const viewport = page.viewportSize()!
  const windows = ['PROMPT_STUDIO.EXE — MISSION 5', 'BUILDER.EXE', 'AI_OUTPUT.TXT'].map((name) => page.getByRole('region', { name }))
  for (const area of [...windows, ada]) {
    const box = (await area.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  }
}

test('a passed mission with a bonus block: Ada says the whole lesson', async ({ page }) => {
  await passWithBonus(page)
})

test.describe('a passed mission with a bonus block, smallest supported viewport (1280 x 600)', () => {
  test.use({ viewport: { width: 1280, height: 600 }, contextOptions: { screen: { width: 1280, height: 720 } } })
  test('Ada says the whole lesson', async ({ page }) => {
    await passWithBonus(page)
  })
})
