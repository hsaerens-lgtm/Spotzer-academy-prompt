// The dungeon's performance on the reference PC (spec 3, criteria 6 and 9): frames per second on floor 1 while the
// player turns, and the gzip weight of the chunks loaded on demand (the dungeon zone, its 3D view, the PDF maker).
// Usage: npm run build && node scripts/perf-dungeon.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/dungeon/perf.md]
// Starts `vite preview` on port 4173 when nothing answers there. A value that cannot be measured is written
// "non mesuré" with its reason: nothing is ever estimated.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'
import { DEFAULT_URL, NOT_MEASURED, gpuList, parseOptions } from './perf-lib.mjs'

const VIEWPORT = { width: 1600, height: 900 }
const SCALE = 1.5
const SETTLE_MS = 3_000
const SAMPLE_MS = 10_000
const TURN_EVERY_MS = 500
const TARGET_FPS = 60

const parsed = parseOptions(process.argv.slice(2))
if (parsed.help || parsed.error) {
  console.log(parsed.error ?? 'Usage: npm run build && node scripts/perf-dungeon.mjs [--url http://localhost:4173] [--runs 3] [--out file.md]')
  process.exit(parsed.error ? 1 : 0)
}
const { url: base, runs, out } = parsed.options

/** The graphics cards and the refresh rate of the display each one drives (CIM), or why they cannot be read. */
function gpus() {
  if (process.platform !== 'win32') return `${NOT_MEASURED} (hors Windows)`
  const query = 'Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name)|$($_.CurrentRefreshRate)" }'
  const result = spawnSync('powershell', ['-NoProfile', '-Command', query], { encoding: 'utf8' })
  return result.status === 0 ? gpuList(result.stdout.trim()) : `${NOT_MEASURED} (CIM indisponible)`
}

const answers = async () => {
  try {
    return (await fetch(base)).ok
  } catch {
    return false
  }
}

/** The gzip weight of the chunks reached from `key` in the Vite manifest, minus those already counted. */
function chunkWeights() {
  const manifestPath = join('dist', '.vite', 'manifest.json')
  if (!existsSync(manifestPath)) return null
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const closure = (key, seen = new Set()) => {
    const chunk = manifest[key]
    if (!chunk || seen.has(key)) return seen
    seen.add(key)
    for (const next of chunk.imports ?? []) closure(next, seen)
    return seen
  }
  const size = (keys) => [...keys].reduce((sum, key) => sum + gzipSync(readFileSync(join('dist', manifest[key].file))).length, 0)
  const find = (pattern) => Object.keys(manifest).find((key) => pattern.test(key))
  const entry = Object.keys(manifest).find((key) => manifest[key].isEntry)
  const initial = closure(entry)
  const minus = (keys, ...others) => new Set([...keys].filter((key) => !others.some((set) => set.has(key))))
  const zoneKey = find(/src\/zones\/dungeon\/index\.tsx$/)
  const canvasKey = find(/src\/zones\/dungeon\/scene\/DungeonCanvas\.tsx$/)
  const pdfKeys = Object.keys(manifest).filter((key) => /node_modules\/(pdf-lib|@pdf-lib\/fontkit)\//.test(key))
  if (!zoneKey || !canvasKey) return null
  const zone = minus(closure(zoneKey), initial)
  const canvas = minus(closure(canvasKey), initial, zone)
  const pdf = minus(new Set(pdfKeys.flatMap((key) => [...closure(key)])), initial, zone, canvas)
  const kib = (bytes) => `${(bytes / 1024).toFixed(0)} Kio`
  return { zone: kib(size(zone)), canvas: kib(size(canvas)), pdf: pdfKeys.length > 0 ? kib(size(pdf)) : `${NOT_MEASURED} (morceau introuvable)` }
}

async function measureOnce(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  const page = await context.newPage()
  try {
    await page.goto(`${base}/#/dungeon?floor=1`)
    await page.locator('.dg-canvas canvas').waitFor({ timeout: 60_000 })
    await page.bringToFront()
    await sleep(SETTLE_MS)
    const turning = (async () => {
      const end = Date.now() + SAMPLE_MS
      while (Date.now() < end) {
        await page.keyboard.press('ArrowLeft')
        await sleep(TURN_EVERY_MS)
      }
    })()
    const fps = await page.evaluate(
      (ms) =>
        new Promise((resolve) => {
          let frames = 0
          const start = performance.now()
          const tick = (now) => {
            frames++
            if (now - start < ms) requestAnimationFrame(tick)
            else resolve((frames / (now - start)) * 1000)
          }
          requestAnimationFrame(tick)
        }),
      SAMPLE_MS,
    )
    await turning
    const width = await page.locator('.dg-canvas canvas').evaluate((canvas) => canvas.width)
    return { fps, width }
  } finally {
    await context.close()
  }
}

let server = null
try {
  if (!(await answers())) {
    if (base !== DEFAULT_URL) throw new Error(`nothing answers on ${base}`)
    if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `npm run build` first')
    server = spawn('npx vite preview --port 4173 --strictPort', { shell: true, stdio: 'ignore' })
    for (let i = 0; i < 60 && !(await answers()); i++) await sleep(500)
  }
  const browser = await chromium.launch({ headless: false, args: ['--use-angle=d3d11'] })
  const samples = []
  try {
    for (let i = 0; i < runs; i++) samples.push(await measureOnce(browser))
  } finally {
    await browser.close()
  }
  const fps = samples.map((s) => s.fps).sort((a, b) => a - b)
  const median = fps[Math.floor(fps.length / 2)]
  const weights = chunkWeights()
  const lines = [
    '# Donjon : mesure de performance',
    '',
    `- Date : ${new Date().toISOString().slice(0, 10)}`,
    `- Build de production servi par \`vite preview\`, Chromium de Playwright avec interface, \`--use-angle=d3d11\`, fenêtre ${VIEWPORT.width} × ${VIEWPORT.height}, facteur d'échelle ${SCALE} (canvas de ${samples[0]?.width ?? NOT_MEASURED} px de large).`,
    `- GPU et écran : ${gpus()}`,
    `- Scénario : étage 1, ${SAMPLE_MS / 1000} s par mesure en tournant d'un quart de tour toutes les ${TURN_EVERY_MS} ms ; ${runs} mesures, chacune dans un contexte neuf.`,
    '',
    '| Mesure | Valeur | Objectif |',
    '|---|---|---|',
    `| Images/s (médiane de ${runs}) | ${median.toFixed(1)} | ${TARGET_FPS} |`,
    `| Images/s (plus basse) | ${fps[0].toFixed(1)} | ${TARGET_FPS} |`,
    `| Morceau de la zone donjon (gzip) | ${weights?.zone ?? NOT_MEASURED} | chargé à la demande |`,
    `| Vue 3D et post-traitement (gzip) | ${weights?.canvas ?? NOT_MEASURED} | chargé à la demande |`,
    `| Générateur de PDF (gzip) | ${weights?.pdf ?? NOT_MEASURED} | chargé au clic sur Download PDF |`,
    '',
    "La fréquence mesurée est plafonnée par celle de l'écran (requestAnimationFrame) : une valeur égale à la fréquence de l'écran veut dire que le donjon suit sans perdre d'image.",
    '',
  ]
  const markdown = lines.join('\n')
  if (out) writeFileSync(out, markdown)
  else console.log(markdown)
} finally {
  if (server) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
}
