import type { Page } from '@playwright/test'
import { expect, state, test } from './fixtures'

/*
 * Journeys of the office redesign (spec 2026-10-06, section 9): time of day, wall clock, keyboard, material audit,
 * self-hosting, a failing decor model, and the laptop and retro corner still reachable once the decor has loaded.
 */

/** Software rendering: each stage (the base, then the decor) is awaited at most 60 s, within the test's 90 s. */
const READY_MS = 60_000

/** Opens the office with a query (for example '?phase=night') from a blank page, and waits for the base stage. */
async function openOffice(page: Page, query = '?phase=day') {
  await page.goto('about:blank')
  await page.goto(`/${query}#/office`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: READY_MS })
}

async function waitForDecor(page: Page) {
  await page.waitForFunction(() => window.__academy?.state().decorReady === true, undefined, { timeout: READY_MS })
}

const screenPosition = (page: Page, name: string) => page.evaluate((n) => window.__academy!.screenPosition!(n), name)
const lighting = (page: Page) => page.evaluate(() => window.__academy!.lighting!())

type Point = { x: number; y: number }

/** Copy of office.spec.ts: waits until a named object stops moving on screen (camera, rail easing and parallax settled). */
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

/** Puts the pointer on the centre of a named object the way office.spec.ts hovers the laptop (aim, let the parallax settle, aim again). */
async function hover(page: Page, name: string): Promise<Point> {
  const approx = await settledPosition(page, name)
  expect(approx, `${name} is on screen`).not.toBeNull()
  await page.mouse.move(approx!.x, approx!.y)
  const exact = await settledPosition(page, name)
  await page.mouse.move(exact!.x, exact!.y)
  return exact!
}

test('?phase=night opens the office at night', async ({ page }) => {
  await openOffice(page, '?phase=night')
  expect((await state(page)).phase).toBe('night')
  await expect.poll(async () => (await lighting(page)).exposure).toBeCloseTo(1.15, 2)
  const night = await lighting(page)
  expect(night.phase).toBe('night')
  expect(night.environmentIntensity).toBeCloseTo(0.05, 2)
  expect(night.transitioning).toBe(false)
  // Read once at start-up, never written back.
  await expect(page).toHaveURL(/\?phase=night#\/office$/)
})

test('clicking the wall clock moves to the next phase', async ({ page }) => {
  await openOffice(page, '?phase=day')
  const day = await lighting(page)
  expect(day.environmentIntensity).toBeCloseTo(0.32, 2)
  const clock = await hover(page, 'clock')
  await expect(page.locator('.object-label')).toHaveText('Change the time of day')
  await page.mouse.click(clock.x, clock.y)
  const clicked = await state(page)
  expect(clicked.phase).toBe('sunset')
  expect(clicked.phaseTransition).toMatchObject({ from: 'day', to: 'sunset' })
  await expect.poll(async () => (await state(page)).phaseTransition, { timeout: 6_000 }).toBeNull()
  const sunset = await lighting(page)
  expect(sunset.transitioning).toBe(false)
  expect(sunset.environmentIntensity).toBeCloseTo(0.18, 2)
  expect(sunset.exposure).toBeCloseTo(1.0, 2)
  expect(sunset.sunColor).not.toBe(day.sunColor)
})

test('the Time of day button works from the keyboard', async ({ page }) => {
  await openOffice(page, '?phase=day')
  const button = page.getByRole('button', { name: 'Time of day' })
  await expect(button).toBeVisible()
  const focused = () => button.evaluate((element) => element === document.activeElement)
  for (let i = 0; i < 25 && !(await focused()); i++) await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await state(page)).phase).toBe('sunset')
})

test('every visible surface of the office is textured', async ({ page }) => {
  await openOffice(page)
  await waitForDecor(page)
  // Entries read `path#material`; only emissive, glass, screen and sky materials may be untextured (and are marked so).
  expect(await page.evaluate(() => window.__academy!.untexturedMeshes!())).toEqual([])
})

test('nothing is fetched from another site', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const foreign: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== origin) foreign.push(request.url())
  })
  await page.goto('/?phase=day#/office')
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: READY_MS })
  await waitForDecor(page)
  // No Draco decoder from gstatic, no drei environment from githack, no font or texture from a CDN.
  expect(foreign).toEqual([])
})

test('a missing d\u00e9cor model leaves the office usable', async ({ page }) => {
  await page.route('**/assets/models/potted_plant_01.glb', (route) => route.abort())
  await openOffice(page)
  await waitForDecor(page)
  // The potted plant is left out on its own; the money tree and the rest of the decor are there.
  expect(await screenPosition(page, 'pottedPlant')).toBeNull()
  expect(await screenPosition(page, 'pachira')).not.toBeNull()
  expect(await screenPosition(page, 'cabinet')).not.toBeNull()
  await hover(page, 'laptop')
  await expect(page.locator('.object-label')).toHaveText('Prompt Workshop')
})

test('the laptop stays hoverable once the d\u00e9cor has loaded', async ({ page }) => {
  await openOffice(page)
  await waitForDecor(page)
  await hover(page, 'laptop')
  await expect(page.locator('.object-label')).toHaveText('Prompt Workshop')
})

test('the retro corner is hoverable from the overview', async ({ page }) => {
  await openOffice(page, '?phase=day')
  await waitForDecor(page)
  expect((await state(page)).railTarget).toBe(0)
  const tv = await hover(page, 'tv')
  await expect(page.locator('.object-label')).toHaveText('The Dungeon')
  // A real click: the console and the TV lead to the dungeon straight from the overview.
  await page.mouse.click(tv.x, tv.y)
  await expect(page.getByRole('heading', { name: 'The Dungeon' })).toBeVisible()
})

// Task 12 review: the canvas of the 3D mode is a new one after reading mode, and compiles every shader again. The
// loading screen covers it until the office is drawn, instead of the empty background behind a hidden base.
test('back from reading mode, the loading screen covers the office until it is ready again', async ({ page }) => {
  await openOffice(page)
  await page.getByRole('button', { name: 'Reading mode' }).click()
  await expect(page.getByRole('main', { name: 'Reading mode' })).toBeVisible()
  expect((await state(page)).sceneReady).toBe(false)
  await page.getByRole('button', { name: '3D mode' }).click()
  await expect(page.locator('.loading')).toBeVisible()
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: READY_MS })
  await expect(page.locator('.loading')).toHaveCount(0)
  await expect(page.getByTestId('stage')).toHaveAttribute('data-scene-ready', 'true')
})
