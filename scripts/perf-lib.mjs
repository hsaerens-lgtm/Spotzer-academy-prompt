// Pure helpers of scripts/perf.mjs (no browser, no disk): the command line, the graphics cards line, the check that
// the server sends this worktree's build, and the quality tiers read around the frame-rate samples.
import { parseArgs } from 'node:util'

export const DEFAULT_URL = 'http://localhost:4173'
export const NOT_MEASURED = 'non mesur\u00e9'
export const USAGE = 'Usage: npm run build && node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/office/perf.md]'
const MAX_RUNS = 10

/**
 * The command line, checked: { help: true }, { error } (a message that ends with the usage) or
 * { options: { url, runs, out } }, the URL without its trailing slashes.
 */
export function parseOptions(args) {
  let values
  try {
    ;({ values } = parseArgs({
      args,
      options: {
        url: { type: 'string', default: DEFAULT_URL },
        runs: { type: 'string', default: '3' },
        out: { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    }))
  } catch (error) {
    // Node's messages carry no final full stop; one is added so that the usage reads as its own sentence.
    return { error: `${error.message.replace(/\.?$/, '.')} ${USAGE}` }
  }
  if (values.help) return { help: true }
  if (!/^[1-9]\d*$/.test(values.runs) || Number(values.runs) > MAX_RUNS) {
    return { error: `--runs must be a whole number from 1 to ${MAX_RUNS}. ${USAGE}` }
  }
  return { options: { url: values.url.replace(/\/+$/, ''), runs: Number(values.runs), out: values.out } }
}

/**
 * The graphics cards from Windows (one "Name|CurrentRefreshRate" line per Win32_VideoController), each with the
 * refresh rate of its display. A card that drives no display has no refresh rate.
 */
export function gpuList(cimOutput) {
  return cimOutput
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const cut = line.lastIndexOf('|')
      const name = (cut < 0 ? line : line.slice(0, cut)).trim()
      const hertz = Number(cut < 0 ? '' : line.slice(cut + 1).trim())
      return hertz > 0 ? `${name}, ${hertz} Hz` : `${name}, ${NOT_MEASURED} (pas d'\u00e9cran)`
    })
    .join(' ; ')
}

/** The page the server sends is this worktree's dist/index.html, whose script names carry the build's hashes. */
export function sameBuild(servedHtml, distHtml) {
  return servedHtml === distHtml
}

/** The tiers read around the frame-rate samples, each change kept ("high -> low -> high"); null when one is missing. */
export function tierCell(tiers) {
  if (!tiers || tiers.length === 0 || tiers.some((tier) => tier === null)) return null
  return tiers.filter((tier, i) => i === 0 || tier !== tiers[i - 1]).join(' \u2192 ')
}
