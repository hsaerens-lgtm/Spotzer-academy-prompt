// Performance of the production build on the reference PC (spec 2026-10-06, criterion 5), for each time of day:
// time until the office shows, time until the decor has loaded, frames per second in the overview and in the
// presentation view, and the quality tier around each sample. Writes the Markdown of docs/evidence/office/perf.md.
// Usage: npm run build && node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/office/perf.md]
// Without --out the Markdown goes to the standard output. Starts `vite preview` on port 4173 when nothing answers there,
// and refuses a server that does not send this worktree's dist/index.html.
// A value that cannot be measured is written "non mesure" with its reason: nothing is ever estimated.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium, errors } from '@playwright/test'
import { DEFAULT_URL, NOT_MEASURED, USAGE, gpuList, parseOptions, sameBuild, tierCell } from './perf-lib.mjs'

const PHASES = ['day', 'sunset', 'night']
const PHASE_LABELS = { day: 'Jour', sunset: 'Coucher', night: 'Nuit' }
const LOAD_TIMEOUT_MS = 60_000
const SETTLE_MS = 3_000
const SAMPLE_MS = 5_000
const VIEWPORT = { width: 1600, height: 900 }
const SCALE = 1.5
const TARGETS = { fps: 60, officeMs: 3_000, decorMs: 8_000, initialJsMiB: 1.5 }
const DIST_INDEX = 'dist/index.html'
const STAGE = '[data-testid="stage"]'

const parsed = parseOptions(process.argv.slice(2))
if (parsed.help) {
  console.log(USAGE)
  process.exit(0)
}
if (parsed.error) {
  console.error(parsed.error)
  process.exit(1)
}
const { url: base, runs, out } = parsed.options

let server = null
const browsers = new Set()

// Ctrl+C: on POSIX the preview runs in its own process group and would outlive the script. Stop it, close the
// browsers (Playwright's own handler closes them too), then leave.
process.on('SIGINT', () => {
  if (server) stopServer(server)
  server = null
  Promise.allSettled([...browsers].map((browser) => browser.close())).finally(() => process.exit(130))
})

async function serverAnswers() {
  try {
    return (await fetch(base)).ok
  } catch {
    return false
  }
}

/** Starts `vite preview` on port 4173 (the production build in dist/) and waits for it; returns the child process. */
async function startPreview() {
  if (base !== DEFAULT_URL) throw new Error(`nothing answers on ${base}; start the server or leave --url out`)
  if (!existsSync(DIST_INDEX)) throw new Error('dist/ is missing: run `npm run build` first')
  const child = spawn('npx vite preview --port 4173 --strictPort', { shell: true, stdio: 'ignore', detached: process.platform !== 'win32' })
  const deadline = Date.now() + LOAD_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await serverAnswers()) return child
    await sleep(500)
  }
  stopServer(child)
  throw new Error(`vite preview did not answer on ${base} within ${LOAD_TIMEOUT_MS / 1000} s`)
}

function stopServer(child) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch (error) {
    // ESRCH: the process group has already gone.
    if (error.code !== 'ESRCH') throw error
  }
}

/** Measuring another build (an older dist/, another worktree's preview) would put wrong values under this commit. */
async function assertServesThisBuild() {
  if (!existsSync(DIST_INDEX)) throw new Error('dist/ is missing: run `npm run build` first')
  const served = await (await fetch(`${base}/`)).text()
  if (!sameBuild(served, readFileSync(DIST_INDEX, 'utf8'))) {
    throw new Error(`${base} does not send this worktree's ${DIST_INDEX}: stop the server that answers there, or run \`npm run build\` and serve this dist/`)
  }
}

async function launchBrowser() {
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=d3d11'] })
  browsers.add(browser)
  browser.on('disconnected', () => browsers.delete(browser))
  return browser
}

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

const firstLine = (message) => message.split('\n')[0]

/** The machine as Windows describes it (CIM), or the reason it cannot be read. */
function machine() {
  const cpu = os.cpus()[0]?.model.trim() ?? NOT_MEASURED
  const ram = `${Math.round(os.totalmem() / 1024 ** 3)} Go de RAM`
  const system = `${os.version()} ${os.release()}`
  if (process.platform !== 'win32') return { model: `${NOT_MEASURED} (hors Windows)`, cpu, ram, system, gpus: `${NOT_MEASURED} (hors Windows)` }
  const cim = (query) => run('powershell', ['-NoProfile', '-Command', query])
  const model = cim('$c = Get-CimInstance Win32_ComputerSystem; "$($c.Manufacturer) $($c.Model)"') ?? `${NOT_MEASURED} (CIM indisponible)`
  const cards = cim('Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name)|$($_.CurrentRefreshRate)" }')
  return { model, cpu, ram, system, gpus: cards ? gpuList(cards) : `${NOT_MEASURED} (CIM indisponible)` }
}

/** Initial JS (gzip) as scripts/check-bundle.mjs reports it, in MiB. */
function initialJs() {
  const output = run('node', ['scripts/check-bundle.mjs'])
  const match = output?.match(/Initial JS \(gzip\): ([\d.]+) MB/)
  return match ? Number(match[1]) : null
}

/** requestAnimationFrame rate over SAMPLE_MS: what the page really draws (capped by the display). */
const fpsInPage = (ms) =>
  new Promise((resolve) => {
    let frames = 0
    const start = performance.now()
    const tick = (now) => {
      frames++
      if (now - start < ms) requestAnimationFrame(tick)
      else resolve((frames / (now - start)) * 1000)
    }
    requestAnimationFrame(tick)
  })

/**
 * Installed before any page script: records performance.now() (ms since the navigation started) at the first DOM
 * change where the office shows (stage marked data-scene-ready, canvas present, loading screen gone), where the decor
 * is ready, and where the site fell back to reading mode (the base stage failed). Once both instants are known, or
 * reading mode ends the wait, the observer disconnects: the frame-rate samples pay nothing for it.
 */
function recordMarks() {
  const marks = {}
  window.perfMarks = marks
  const observer = new MutationObserver(() => {
    const now = performance.now()
    const stage = document.querySelector('[data-testid="stage"]')
    if (marks.office === undefined && stage?.getAttribute('data-scene-ready') === 'true' && stage.querySelector('canvas') && !document.querySelector('.loading')) marks.office = now
    if (marks.decor === undefined && stage?.getAttribute('data-decor-ready') === 'true') marks.decor = now
    if (marks.reading === undefined && document.querySelector('main[aria-label="Reading mode"]')) marks.reading = now
    if ((marks.office !== undefined && marks.decor !== undefined) || marks.reading !== undefined) observer.disconnect()
  })
  observer.observe(document, { subtree: true, childList: true, attributes: true })
}

/**
 * Waits for a mark: { ms }, { reading: true } when the site fell back to reading mode first, { timeout: true } after
 * LOAD_TIMEOUT_MS, or { failure } with the reason (the page crashed, closed or threw).
 */
async function waitForMark(page, name) {
  let crashed = false
  const onCrash = () => {
    crashed = true
  }
  page.on('crash', onCrash)
  try {
    const handle = await page.waitForFunction(
      (key) => {
        const marks = window.perfMarks ?? {}
        if (marks[key] !== undefined) return Math.round(marks[key])
        return marks.reading !== undefined ? 'reading' : false
      },
      name,
      { timeout: LOAD_TIMEOUT_MS },
    )
    const value = await handle.jsonValue()
    return value === 'reading' ? { reading: true } : { ms: value }
  } catch (error) {
    if (crashed) return { failure: 'la page a plant\u00e9' }
    if (page.isClosed()) return { failure: "la page s'est ferm\u00e9e" }
    if (error instanceof errors.TimeoutError) return { timeout: true }
    return { failure: `erreur : ${firstLine(error.message)}` }
  } finally {
    page.off('crash', onCrash)
  }
}

/** The app's own WebGL context: asking the stage canvas for the type it already has returns that context. */
const appWebgl = () => {
  const gl = document.querySelector('[data-testid="stage"] canvas')?.getContext('webgl2')
  if (!gl) return null
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    powerPreference: gl.getContextAttributes()?.powerPreference ?? null,
  }
}

async function measureLoad(browser, phase) {
  const result = { officeMs: null, decorMs: null, overview: null, presentation: null, tiers: null, webgl: null, canvasWidth: null, notes: [] }
  const skipped = 'images/s et niveau de qualit\u00e9 non mesur\u00e9s'
  let context = null
  try {
    context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
    await context.addInitScript(recordMarks)
    const page = await context.newPage()
    await page.bringToFront()
    await page.goto(`${base}/?phase=${phase}#/office`)
    const office = await waitForMark(page, 'office')
    if (office.ms === undefined) {
      if (office.reading) result.notes.push('le socle a \u00e9chou\u00e9, le site est pass\u00e9 en mode lecture')
      else if (office.timeout) result.notes.push(`bureau non affich\u00e9 apr\u00e8s ${LOAD_TIMEOUT_MS / 1000} s`)
      else result.notes.push(`bureau non affich\u00e9 : ${office.failure}`)
      return result
    }
    result.officeMs = office.ms
    result.webgl = await page.evaluate(appWebgl)
    const decor = await waitForMark(page, 'decor')
    if (decor.ms !== undefined) result.decorMs = decor.ms
    else if (decor.timeout) result.notes.push(`d\u00e9cor non pr\u00eat apr\u00e8s ${LOAD_TIMEOUT_MS / 1000} s`)
    else {
      // Reading mode or a dead page: there is no office left to sample.
      result.notes.push(decor.reading ? `le site est pass\u00e9 en mode lecture pendant le chargement du d\u00e9cor ; ${skipped}` : `d\u00e9cor non pr\u00eat : ${decor.failure} ; ${skipped}`)
      return result
    }
    const tiers = []
    // Read at once (no auto-wait): null when the stage has gone.
    const readTier = async () => tiers.push(await page.evaluate((selector) => document.querySelector(selector)?.getAttribute('data-quality') ?? null, STAGE))
    await sleep(SETTLE_MS)
    await readTier()
    result.overview = Math.round(await page.evaluate(fpsInPage, SAMPLE_MS))
    await readTier()
    await page.mouse.move(800, 300)
    await page.mouse.wheel(0, -1500)
    await sleep(SETTLE_MS)
    await readTier()
    result.presentation = Math.round(await page.evaluate(fpsInPage, SAMPLE_MS))
    await readTier()
    result.tiers = tiers
    if (tiers.includes(null)) result.notes.push('niveau de qualit\u00e9 illisible : la sc\u00e8ne avait disparu')
    result.canvasWidth = await page.evaluate((selector) => document.querySelector(`${selector} canvas`)?.width ?? null, STAGE)
  } catch (error) {
    result.notes.push(`erreur : ${firstLine(error.message)}`)
  } finally {
    await context?.close().catch(() => {})
  }
  return result
}

/** Browser version and display refresh rate, from a throwaway browser: every phase's first load stays a cold start. */
async function probeDisplay() {
  const browser = await launchBrowser()
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
    const page = await context.newPage()
    await page.bringToFront()
    await page.setContent('<p></p>')
    return { browserVersion: browser.version(), refresh: Math.round(await page.evaluate(fpsInPage, 2000)) }
  } finally {
    await browser.close()
  }
}

const cell = (items, unit = '') =>
  items.map((value) => (value === null ? NOT_MEASURED : `${value}${unit}`)).join(' \u00b7 ')
const verdict = (items, ok) => (items.length === 0 || items.some((value) => value === null) ? 'non v\u00e9rifiable' : items.every(ok) ? 'oui' : 'non')
const distinct = (items) => [...new Set(items.filter((item) => item !== null && item !== undefined))]

try {
  if (out) mkdirSync(dirname(resolve(out)), { recursive: true })
  if (!(await serverAnswers())) server = await startPreview()
  await assertServesThisBuild()
  const { browserVersion, refresh } = await probeDisplay()
  const results = {}
  for (const phase of PHASES) {
    // A fresh browser per phase: its first load is a cold start (empty HTTP and shader caches).
    const browser = await launchBrowser()
    try {
      results[phase] = []
      for (let i = 0; i < runs; i++) {
        const load = await measureLoad(browser, phase)
        console.error(`${phase} #${i + 1}: ${JSON.stringify(load)}`)
        results[phase].push(load)
      }
    } finally {
      await browser.close()
    }
  }

  const commit = run('git', ['rev-parse', '--short', 'HEAD']) ?? NOT_MEASURED
  const dirty = run('git', ['status', '--porcelain'])
  const host = machine()
  const js = initialJs()
  const today = new Date().toISOString().slice(0, 10)
  const loads = PHASES.flatMap((phase) => results[phase])
  const column = (pick, unit) => PHASES.map((phase) => cell(results[phase].map(pick), unit))
  const all = (pick) => loads.map(pick)
  const notes = PHASES.flatMap((phase) => results[phase].flatMap((load, i) => load.notes.map((note) => `- ${PHASE_LABELS[phase]}, chargement ${i + 1} : ${note}.`)))
  const firstDecor = PHASES.map((phase) => results[phase][0].decorMs)
  const row = (label, cells, target) => `| ${label} | ${cells.join(' | ')} | ${target} |`
  const renderers = distinct(all((load) => load.webgl?.renderer))
  const preferences = distinct(all((load) => load.webgl?.powerPreference))
  const widths = distinct(all((load) => load.canvasWidth))
  const readTiers = (load) => (load.tiers === null || load.tiers.includes(null) ? null : load.tiers)

  const lines = [
    '# Mesures \u2014 bureau refait (refonte visuelle)',
    '',
    `- Date : ${today}`,
    `- Commit : ${commit}${dirty ? ' (avec des modifications locales non commit\u00e9es)' : ''} ; version de production : \`npm run build\` de ce commit, servie par \`vite preview\``,
    `- Machine : ${host.model} ; ${host.cpu} ; ${host.ram} ; ${host.system}`,
    `- Cartes graphiques (Windows), avec la fr\u00e9quence de leur \u00e9cran : ${host.gpus}`,
    `- Moteur WebGL de la sc\u00e8ne : ${renderers.length > 0 ? renderers.join(' / ') : `${NOT_MEASURED} (le bureau ne s'est jamais affich\u00e9)`}${preferences.length > 0 ? ` (contexte de l'application, \`powerPreference\` ${preferences.map((value) => `\`${value}\``).join(' / ')})` : ''}`,
    `- Navigateur : Chromium ${browserVersion} de Playwright, avec interface, \`--use-angle=d3d11\`, fen\u00eatre ${VIEWPORT.width} \u00d7 ${VIEWPORT.height}, facteur d'\u00e9chelle 1,5 (${widths.length > 0 ? `canvas de ${widths.join(' / ')} px de large, lu sur la page` : `largeur du canvas ${NOT_MEASURED}`})`,
    `- Fr\u00e9quence d'affichage mesur\u00e9e sur une page vide : ${refresh} images/s`,
    '',
    `Chaque case donne les ${runs} chargements dans l'ordre (le premier est un d\u00e9marrage \u00e0 froid du navigateur), s\u00e9par\u00e9s par \u00ab \u00b7 \u00bb.`,
    '',
    `| Mesure | ${PHASES.map((phase) => PHASE_LABELS[phase]).join(' | ')} | Cible |`,
    `|---|${PHASES.map(() => '---').join('|')}|---|`,
    row("Images/s, vue d'ensemble", column((load) => load.overview, ''), `\u2265 ${TARGETS.fps}`),
    row('Images/s, vue pr\u00e9sentation', column((load) => load.presentation, ''), `\u2265 ${TARGETS.fps}`),
    row('Bureau affich\u00e9 apr\u00e8s', column((load) => load.officeMs, ' ms'), `< ${TARGETS.officeMs} ms`),
    row('D\u00e9cor charg\u00e9 apr\u00e8s', column((load) => load.decorMs, ' ms'), `< ${TARGETS.decorMs} ms au 1er chargement`),
    row('Niveau de qualit\u00e9 autour des mesures', column((load) => tierCell(load.tiers), ''), 'jamais `low`'),
    `| JS initial (gzip) | ${js === null ? `${NOT_MEASURED} (scripts/check-bundle.mjs sans r\u00e9sultat : lancer \`npm run build\`)` : `${js.toFixed(2).replace('.', ',')} Mo`} | | | \u2264 1,50 Mo |`,
    '',
    '## Crit\u00e8re 5 de la spec',
    '',
    `- Au moins ${TARGETS.fps} images/s dans chaque vue et chaque phase : ${verdict([...all((load) => load.overview), ...all((load) => load.presentation)], (fps) => fps >= TARGETS.fps)}.`,
    `- Le niveau de qualit\u00e9 ne tombe pas \u00e0 \`low\` : ${verdict(all(readTiers), (tiers) => !tiers.includes('low'))}.`,
    `- Bureau affich\u00e9 en moins de ${TARGETS.officeMs / 1000} s : ${verdict(all((load) => load.officeMs), (ms) => ms < TARGETS.officeMs)}.`,
    `- Tous les d\u00e9cors charg\u00e9s en moins de ${TARGETS.decorMs / 1000} s au premier chargement : ${verdict(firstDecor, (ms) => ms < TARGETS.decorMs)}.`,
    `- JS initial \u2264 ${TARGETS.initialJsMiB.toFixed(2).replace('.', ',')} Mo : ${verdict([js], (mib) => mib <= TARGETS.initialJsMiB)}.`,
    ...(notes.length > 0 ? ['', '## Valeurs non mesur\u00e9es', '', ...notes] : []),
    '',
    '## M\u00e9thode',
    '',
    `- \`node scripts/perf.mjs --runs ${runs}\` apr\u00e8s \`npm run build\` ; le script v\u00e9rifie que le serveur envoie le \`dist/index.html\` de ce dossier. Un navigateur jetable mesure d'abord la fr\u00e9quence d'affichage, puis un navigateur neuf par phase fait ${runs} chargements, chacun dans un contexte neuf ; la phase est forc\u00e9e par \`?phase=\`.`,
    '- Bureau affich\u00e9 : `performance.now()` (depuis le d\u00e9but de la navigation) \u00e0 la premi\u00e8re modification du DOM o\u00f9 `[data-testid="stage"]` porte `data-scene-ready="true"`, o\u00f9 le canvas existe et o\u00f9 l\'\u00e9cran de chargement a disparu (`MutationObserver` install\u00e9 avant les scripts de la page, d\u00e9branch\u00e9 d\u00e8s que les deux instants sont relev\u00e9s).',
    '- D\u00e9cor charg\u00e9 : m\u00eame horloge, \u00e0 la premi\u00e8re modification du DOM o\u00f9 `data-decor-ready="true"` (plantes, livres, cadres, suspensions, caisson et table basse affich\u00e9s, ou omis apr\u00e8s un \u00e9chec).',
    `- Images/s : nombre de \`requestAnimationFrame\` pendant ${SAMPLE_MS / 1000} s, ${SETTLE_MS / 1000} s apr\u00e8s le chargement du d\u00e9cor (vue d'ensemble ; apr\u00e8s les ${LOAD_TIMEOUT_MS / 1000} s d'attente s'il n'est pas pr\u00eat), puis ${SETTLE_MS / 1000} s apr\u00e8s un d\u00e9filement \u00e0 la molette vers la vue pr\u00e9sentation. Rien n'est mesur\u00e9 quand le site passe en mode lecture.`,
    '- Niveau de qualit\u00e9 : attribut `data-quality` de la sc\u00e8ne (r\u00e9gl\u00e9 par le `PerformanceMonitor` de drei), relev\u00e9 juste avant et juste apr\u00e8s chacune des deux mesures d\'images/s ; la case donne la suite des niveaux relev\u00e9s.',
    '- Moteur WebGL : cha\u00eene `UNMASKED_RENDERER_WEBGL` du contexte WebGL 2 du canvas de la sc\u00e8ne, celui de l\'application ; largeur du canvas lue sur la page \u00e0 la fin de chaque chargement.',
    "- Premier plan : le script met chaque page au premier plan (`page.bringToFront()`), sans pouvoir v\u00e9rifier que la fen\u00eatre y reste : Playwright \u00e9mule le focus (`document.hasFocus()` vaut toujours vrai) et garde le rendu des fen\u00eatres masqu\u00e9es (`--disable-backgrounding-occluded-windows`). Le protocole demande de lancer la mesure navigateur au premier plan, sans toucher \u00e0 la machine.",
    '- JS initial : sortie de `scripts/check-bundle.mjs` (gzip du chunk d\'entr\u00e9e et de ses imports statiques, en Mio).',
    '- Les mesures du premier bureau (sous-projet 1, 2026-09-30, commit f2336b4) restent dans l\'historique git de ce fichier.',
    '',
  ]
  const markdown = lines.join('\n')
  if (out) {
    writeFileSync(out, markdown)
    console.error(`wrote ${out}`)
  } else {
    console.log(markdown)
  }
} catch (error) {
  console.error(`perf failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (server) stopServer(server)
  server = null
}
