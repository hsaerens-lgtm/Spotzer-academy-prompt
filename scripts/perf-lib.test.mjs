import { expect, test } from 'vitest'
import { DEFAULT_URL, NOT_MEASURED, USAGE, gpuList, parseOptions, sameBuild, tierCell } from './perf-lib.mjs'

test('parseOptions keeps the defaults and reads --url, --runs and --out', () => {
  expect(parseOptions([])).toEqual({ options: { url: DEFAULT_URL, runs: 3, out: undefined } })
  expect(parseOptions(['--url', 'http://localhost:4173//', '--runs', '10', '--out', 'docs/perf.md'])).toEqual({
    options: { url: 'http://localhost:4173', runs: 10, out: 'docs/perf.md' },
  })
  expect(parseOptions(['--runs=1'])).toEqual({ options: { url: DEFAULT_URL, runs: 1, out: undefined } })
})

test('parseOptions answers --help before checking anything else', () => {
  expect(parseOptions(['--help'])).toEqual({ help: true })
  expect(parseOptions(['--help', '--runs', '0'])).toEqual({ help: true })
})

test('parseOptions accepts only a whole number of runs from 1 to 10', () => {
  for (const runs of ['0', '11', '3abc', '1e1', '2.5', '-1', '', ' 3']) {
    expect(parseOptions([`--runs=${runs}`]), runs).toEqual({ error: `--runs must be a whole number from 1 to 10. ${USAGE}` })
  }
})

test('parseOptions refuses an unknown flag or a stray argument, with the usage', () => {
  expect(parseOptions(['--rnus', '3'])).toEqual({ error: `Unknown option '--rnus'. ${USAGE}` })
  const stray = parseOptions(['perf.md'])
  expect(stray.error).toMatch(/^Unexpected argument 'perf.md'.*\. Usage: /)
  expect(stray.error.endsWith(USAGE)).toBe(true)
})

test('gpuList gives each card the refresh rate of its display, or says it drives none', () => {
  const cim = 'NVIDIA GeForce RTX 5070 Laptop GPU|\r\nAMD Radeon(TM) 860M Graphics|240\r\n'
  expect(gpuList(cim)).toBe(`NVIDIA GeForce RTX 5070 Laptop GPU, ${NOT_MEASURED} (pas d'\u00e9cran) ; AMD Radeon(TM) 860M Graphics, 240 Hz`)
  expect(gpuList('Basic Display|0')).toBe(`Basic Display, ${NOT_MEASURED} (pas d'\u00e9cran)`)
  expect(gpuList('A|B card|60')).toBe('A|B card, 60 Hz')
})

test("sameBuild: the server must send this worktree's dist/index.html, byte for byte", () => {
  const html = '<!doctype html><script type="module" crossorigin src="./assets/index-Dnnn17kT.js"></script>'
  expect(sameBuild(html, html)).toBe(true)
  expect(sameBuild(html.replace('Dnnn17kT', 'B7x2Lq0e'), html)).toBe(false)
  expect(sameBuild('', html)).toBe(false)
})

test('tierCell keeps every change of tier, and is null when a reading is missing', () => {
  expect(tierCell(['high', 'high', 'high', 'high'])).toBe('high')
  expect(tierCell(['high', 'low', 'low', 'high'])).toBe('high \u2192 low \u2192 high')
  expect(tierCell(['high', null, 'high', 'high'])).toBeNull()
  expect(tierCell(null)).toBeNull()
  expect(tierCell([])).toBeNull()
})
