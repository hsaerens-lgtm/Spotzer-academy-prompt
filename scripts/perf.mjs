// Performance of the production build on the reference PC (spec 2026-10-06, criterion 5), for each time of day:
// time until the office shows, time until the decor has loaded, frames per second in the overview and in the
// presentation view, and the quality tier at the end. Writes the Markdown of docs/evidence/office/perf.md.
// Usage: npm run build && node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/office/perf.md]
// Without --out the Markdown goes to the standard output. Starts `vite preview` on port 4173 when nothing answers there.
// A value that cannot be measured is written "non mesure" with its reason: nothing is ever estimated.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const DEFAULT_URL = 'http://localhost:4173'
const PHASES = ['day', 'sunset', 'night']
const PHASE_LABELS = { day: 'Jour', sunset: 'Coucher', night: 'Nuit' }
const LOAD_TIMEOUT_MS = 60_000
const SETTLE_MS = 3_000
const SAMPLE_MS = 5_000
const VIEWPORT = { width: 1600, height: 900 }
const SCALE = 1.5
const TARGETS = { fps: 60, officeMs: 3_000, decorMs: 8_000, initialJsMiB: 1.5 }
const NOT_MEASURED = 'non mesur\u00e9'

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: DEFAULT_URL },
    runs: { type: 'string', default: '3' },
    out: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
})
const usage = 'Usage: npm run build && node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/office/perf.md]'
if (values.help) {
  console.log(usage)
  process.exit(0)
}
const runs = Number.parseInt(values.runs, 10)
if (!Number.isInteger(runs) || runs < 1 || runs > 10) {
  console.error(`--runs must be a whole number from 1 to 10. ${usage}`)
  process.exit(1)
}
const base = values.url.replace(/\/+$/, '')

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
  if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `npm run build` first')
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
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else process.kill(-child.pid, 'SIGTERM')
}

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

/** The machine as Windows describes it (CIM), or the reason it cannot be read. */
function machine() {
  const cpu = os.cpus()[0]?.model.trim() ?? NOT_MEASURED
  const ram = `${Math.round(os.totalmem() / 1024 ** 3)} Go de RAM`
  const system = `${os.version()} ${os.release()}`
  if (process.platform !== 'win32') return { model: `${NOT_MEASURED} (hors Windows)`, cpu, ram, system, gpus: `${NOT_MEASURED} (hors Windows)` }
  const cim = (query) => run('powershell', ['-NoProfile', '-Command', query])
  const model = cim('$c = Get-CimInstance Win32_ComputerSystem; "$($c.Manufacturer) $($c.Model)"') ?? `${NOT_MEASURED} (CIM indisponible)`
  const gpus =
    cim('(Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name) ($($_.CurrentRefreshRate) Hz)" }) -join ", "') ??
    `${NOT_MEASURED} (CIM indisponible)`
  return { model, cpu, ram, system, gpus }
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
 * is ready, and where the site fell back to reading mode (the base stage failed).
 */
function recordMarks() {
  const marks = {}
  window.perfMarks = marks
  const check = () => {
    const now = performance.now()
    const stage = document.querySelector('[data-testid="stage"]')
    if (marks.office === undefined && stage?.getAttribute('data-scene-ready') === 'true' && stage.querySelector('canvas') && !document.querySelector('.loading')) marks.office = now
    if (marks.decor === undefined && stage?.getAttribute('data-decor-ready') === 'true') marks.decor = now
    if (marks.reading === undefined && document.querySelector('main[aria-label="Reading mode"]')) marks.reading = now
  }
  new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true })
}

/** The mark once it exists, or 'reading' when the site fell back to reading mode first; null after the timeout. */
async function waitForMark(page, name) {
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
    return await handle.jsonValue()
  } catch {
    return null
  }
}

async function measureLoad(browser, phase) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  await context.addInitScript(recordMarks)
  const page = await context.newPage()
  await page.bringToFront()
  const result = { officeMs: null, decorMs: null, overview: null, presentation: null, quality: null, notes: [] }
  try {
    await page.goto(`${base}/?phase=${phase}#/office`)
    const office = await waitForMark(page, 'office')
    if (typeof office !== 'number') {
      result.notes.push(office === 'reading' ? 'le socle a \u00e9chou\u00e9, le site est pass\u00e9 en mode lecture' : `bureau non affich\u00e9 apr\u00e8s ${LOAD_TIMEOUT_MS / 1000} s`)
      return result
    }
    result.officeMs = office
    const decor = await waitForMark(page, 'decor')
    if (typeof decor === 'number') result.decorMs = decor
    else result.notes.push(decor === 'reading' ? 'le site est pass\u00e9 en mode lecture pendant le chargement du d\u00e9cor' : `d\u00e9cor non pr\u00eat apr\u00e8s ${LOAD_TIMEOUT_MS / 1000} s`)
    await sleep(SETTLE_MS)
    result.overview = Math.round(await page.evaluate(fpsInPage, SAMPLE_MS))
    await page.mouse.move(800, 300)
    await page.mouse.wheel(0, -1500)
    await sleep(SETTLE_MS)
    result.presentation = Math.round(await page.evaluate(fpsInPage, SAMPLE_MS))
    result.quality = await page.getAttribute('[data-testid="stage"]', 'data-quality')
  } catch (error) {
    result.notes.push(`erreur : ${error.message.split('\n')[0]}`)
  } finally {
    await context.close()
  }
  return result
}

/** WebGL renderer string and display refresh rate, read from a blank page of the same browser. */
async function probe(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  const page = await context.newPage()
  await page.bringToFront()
  await page.setContent('<canvas></canvas>')
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2')
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  })
  const refresh = Math.round(await page.evaluate(fpsInPage, 2000))
  await context.close()
  return { renderer, refresh }
}

const cell = (items, unit = '') =>
  items.map((value) => (value === null ? NOT_MEASURED : `${value}${unit}`)).join(' \u00b7 ')
const verdict = (items, ok) => (items.length === 0 || items.some((value) => value === null) ? 'non v\u00e9rifiable' : items.every(ok) ? 'oui' : 'non')

let server = null
try {
  if (!(await serverAnswers())) server = await startPreview()
  const results = {}
  let browserVersion = null
  let probed = null
  for (const phase of PHASES) {
    // A fresh browser per phase: its first load is a cold start (empty HTTP and shader caches).
    const browser = await chromium.launch({ headless: false, args: ['--use-angle=d3d11'] })
    browserVersion ??= browser.version()
    probed ??= await probe(browser)
    results[phase] = []
    for (let i = 0; i < runs; i++) {
      const load = await measureLoad(browser, phase)
      console.error(`${phase} #${i + 1}: ${JSON.stringify(load)}`)
      results[phase].push(load)
    }
    await browser.close()
  }

  const commit = run('git', ['rev-parse', '--short', 'HEAD']) ?? NOT_MEASURED
  const dirty = run('git', ['status', '--porcelain'])
  const host = machine()
  const js = initialJs()
  const today = new Date().toISOString().slice(0, 10)
  const column = (pick, unit) => PHASES.map((phase) => cell(results[phase].map(pick), unit))
  const all = (pick) => PHASES.flatMap((phase) => results[phase].map(pick))
  const notes = PHASES.flatMap((phase) => results[phase].flatMap((load, i) => load.notes.map((note) => `- ${PHASE_LABELS[phase]}, chargement ${i + 1} : ${note}.`)))
  const firstDecor = PHASES.map((phase) => results[phase][0].decorMs)
  const row = (label, cells, target) => `| ${label} | ${cells.join(' | ')} | ${target} |`

  const lines = [
    '# Mesures \u2014 bureau refait (refonte visuelle)',
    '',
    `- Date : ${today}`,
    `- Commit : ${commit}${dirty ? ' (avec des modifications locales non commit\u00e9es)' : ''} ; version de production : \`npm run build\` de ce commit, servie par \`vite preview\``,
    `- Machine : ${host.model} ; ${host.cpu} ; ${host.ram} ; ${host.system}`,
    `- Cartes graphiques (Windows) : ${host.gpus}`,
    `- Moteur WebGL de la page : ${probed.renderer ?? `${NOT_MEASURED} (WebGL 2 indisponible)`}`,
    `- Navigateur : Chromium ${browserVersion} de Playwright, avec interface, \`--use-angle=d3d11\`, fen\u00eatre ${VIEWPORT.width} \u00d7 ${VIEWPORT.height}, facteur d'\u00e9chelle 1,5 (canvas de ${VIEWPORT.width * SCALE} px de large)`,
    `- Fr\u00e9quence d'affichage mesur\u00e9e sur une page vide : ${probed.refresh} images/s`,
    '',
    `Chaque case donne les ${runs} chargements dans l'ordre (le premier est un d\u00e9marrage \u00e0 froid du navigateur), s\u00e9par\u00e9s par \u00ab \u00b7 \u00bb.`,
    '',
    `| Mesure | ${PHASES.map((phase) => PHASE_LABELS[phase]).join(' | ')} | Cible |`,
    `|---|${PHASES.map(() => '---').join('|')}|---|`,
    row("Images/s, vue d'ensemble", column((load) => load.overview, ''), `\u2265 ${TARGETS.fps}`),
    row('Images/s, vue pr\u00e9sentation', column((load) => load.presentation, ''), `\u2265 ${TARGETS.fps}`),
    row('Bureau affich\u00e9 apr\u00e8s', column((load) => load.officeMs, ' ms'), `< ${TARGETS.officeMs} ms`),
    row('D\u00e9cor charg\u00e9 apr\u00e8s', column((load) => load.decorMs, ' ms'), `< ${TARGETS.decorMs} ms au 1er chargement`),
    row('Niveau de qualit\u00e9 \u00e0 la fin', column((load) => load.quality, ''), 'pas `low`'),
    `| JS initial (gzip) | ${js === null ? `${NOT_MEASURED} (scripts/check-bundle.mjs sans r\u00e9sultat : lancer \`npm run build\`)` : `${js.toFixed(2).replace('.', ',')} Mo`} | | | \u2264 1,50 Mo |`,
    '',
    '## Crit\u00e8re 5 de la spec',
    '',
    `- Au moins ${TARGETS.fps} images/s dans chaque vue et chaque phase : ${verdict([...all((load) => load.overview), ...all((load) => load.presentation)], (fps) => fps >= TARGETS.fps)}.`,
    `- Le niveau de qualit\u00e9 ne tombe pas \u00e0 \`low\` : ${verdict(all((load) => load.quality), (quality) => quality !== 'low')}.`,
    `- Bureau affich\u00e9 en moins de ${TARGETS.officeMs / 1000} s : ${verdict(all((load) => load.officeMs), (ms) => ms < TARGETS.officeMs)}.`,
    `- Tous les d\u00e9cors charg\u00e9s en moins de ${TARGETS.decorMs / 1000} s au premier chargement : ${verdict(firstDecor, (ms) => ms < TARGETS.decorMs)}.`,
    `- JS initial \u2264 ${TARGETS.initialJsMiB.toFixed(2).replace('.', ',')} Mo : ${verdict([js], (mib) => mib <= TARGETS.initialJsMiB)}.`,
    ...(notes.length > 0 ? ['', '## Valeurs non mesur\u00e9es', '', ...notes] : []),
    '',
    '## M\u00e9thode',
    '',
    `- \`node scripts/perf.mjs --runs ${runs}\` apr\u00e8s \`npm run build\`. Un navigateur neuf par phase, ${runs} chargements par phase, chacun dans un contexte neuf ; la phase est forc\u00e9e par \`?phase=\`.`,
    '- Bureau affich\u00e9 : `performance.now()` (depuis le d\u00e9but de la navigation) \u00e0 la premi\u00e8re modification du DOM o\u00f9 `[data-testid="stage"]` porte `data-scene-ready="true"`, o\u00f9 le canvas existe et o\u00f9 l\'\u00e9cran de chargement a disparu (`MutationObserver` install\u00e9 avant les scripts de la page).',
    '- D\u00e9cor charg\u00e9 : m\u00eame horloge, \u00e0 la premi\u00e8re modification du DOM o\u00f9 `data-decor-ready="true"` (plantes, livres, cadres, suspensions, caisson et table basse affich\u00e9s, ou omis apr\u00e8s un \u00e9chec).',
    `- Images/s : nombre de \`requestAnimationFrame\` pendant ${SAMPLE_MS / 1000} s, ${SETTLE_MS / 1000} s apr\u00e8s l'affichage (vue d'ensemble), puis ${SETTLE_MS / 1000} s apr\u00e8s un d\u00e9filement \u00e0 la molette vers la vue pr\u00e9sentation. La fen\u00eatre du navigateur reste au premier plan pendant la mesure.`,
    '- Niveau de qualit\u00e9 : attribut `data-quality` de la sc\u00e8ne \u00e0 la fin du chargement (r\u00e9gl\u00e9 par le `PerformanceMonitor` de drei).',
    '- JS initial : sortie de `scripts/check-bundle.mjs` (gzip du chunk d\'entr\u00e9e et de ses imports statiques, en Mio).',
    '- Les mesures du premier bureau (sous-projet 1, 2026-09-30, commit f2336b4) restent dans l\'historique git de ce fichier.',
    '',
  ]
  const markdown = lines.join('\n')
  if (values.out) {
    writeFileSync(values.out, markdown)
    console.error(`wrote ${values.out}`)
  } else {
    console.log(markdown)
  }
} catch (error) {
  console.error(`perf failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (server) stopServer(server)
}
