// Review and evidence screenshots of the office, rendered by Chromium on the real GPU (ANGLE on Direct3D 11).
// Usage: node scripts/shots.mjs --out <dir> [--phases day,sunset,night] [--views overview,presentation,tv] [--prefix <text>] [--wait-decor]
// Uses the dev server on http://localhost:<E2E_PORT, default 5199> (the Playwright port), starting one when nothing answers there.
// Another worktree can use 5199 at the same time: set E2E_PORT to use a different port (empty means unset).
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const PORT = process.env.E2E_PORT || '5199'
const BASE = `http://localhost:${PORT}`
const PHASES = ['day', 'sunset', 'night']
const VIEWS = ['overview', 'presentation', 'tv']
const READY_MS = 60_000

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    phases: { type: 'string', default: 'day' },
    views: { type: 'string', default: 'overview,presentation' },
    prefix: { type: 'string', default: '' },
    'wait-decor': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})
const usage = 'Usage: node scripts/shots.mjs --out <dir> [--phases day,sunset,night] [--views overview,presentation,tv] [--prefix <text>] [--wait-decor]'
if (values.help) {
  console.log(usage)
  process.exit(0)
}
const list = (text, allowed, what) => {
  const items = text.split(',').map((item) => item.trim()).filter(Boolean)
  const wrong = items.filter((item) => !allowed.includes(item))
  if (items.length === 0 || wrong.length > 0) {
    console.error(`Unknown ${what}: ${wrong.join(', ') || '(none given)'}. Choose among ${allowed.join(', ')}.`)
    process.exit(1)
  }
  return items
}
if (!values.out) {
  console.error(usage)
  process.exit(1)
}
const phases = list(values.phases, PHASES, 'phase')
const views = list(values.views, VIEWS, 'view')

async function serverAnswers() {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

/** Starts `npm run dev` on the Playwright port and waits for it; returns the child process. */
async function startServer() {
  // One command string with shell: true runs npm.cmd on Windows (Node refuses to spawn .cmd files without a shell).
  const child = spawn(`npm run dev -- --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore', detached: process.platform !== 'win32' })
  const deadline = Date.now() + READY_MS
  while (Date.now() < deadline) {
    if (await serverAnswers()) return child
    await sleep(500)
  }
  stopServer(child)
  throw new Error(`the dev server did not answer on ${BASE} within ${READY_MS / 1000} s`)
}

function stopServer(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else process.kill(-child.pid, 'SIGTERM')
}

async function openOffice(page, phase) {
  await page.goto('about:blank')
  await page.goto(`${BASE}/?phase=${phase}#/office`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: READY_MS })
  if (values['wait-decor']) {
    try {
      await page.waitForFunction(() => window.__academy?.state().decorReady === true, undefined, { timeout: READY_MS })
    } catch {
      console.warn(`warning: ${phase}: the decor was not ready after ${READY_MS / 1000} s, shooting anyway`)
    }
  }
  await sleep(1500)
}

async function shoot(page, name) {
  const path = join(values.out, `${values.prefix}${name}.png`)
  await page.screenshot({ path })
  console.log(`saved ${path}`)
}

let server = null
let browser = null
try {
  mkdirSync(values.out, { recursive: true })
  if (!(await serverAnswers())) server = await startServer()
  browser = await chromium.launch({ headless: false, args: ['--use-angle=d3d11'] })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  for (const phase of phases) {
    await openOffice(page, phase)
    for (const view of views) {
      if (view === 'overview') {
        await page.evaluate(() => window.__academy.rail(0))
        await sleep(2000)
        await shoot(page, `${phase}-overview`)
      } else if (view === 'presentation') {
        await page.evaluate(() => window.__academy.rail(1))
        await sleep(2500)
        await shoot(page, `${phase}-presentation`)
      } else {
        await page.evaluate(() => window.__academy.clickObject('tv'))
        await sleep(1100)
        await shoot(page, `${phase}-tv`)
        // The flight ends in another zone: reload the office when more views follow.
        if (view !== views.at(-1)) await openOffice(page, phase)
      }
    }
  }
} catch (error) {
  console.error(`shots failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  if (server) stopServer(server)
}
