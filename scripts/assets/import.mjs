// Unpacks a model downloaded by hand (a Sketchfab glTF zip or a Khronos .glb, CC BY 4.0) into assets-src/<id>/, where assets:build reads it.
// Usage: npm run assets:import -- --id <asset id> --file <path to the downloaded .zip or .glb>
// The download is untrusted: read within the zip limits, written only under assets-src/<id>/, model files only (planImport).
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { ATTRIBUTED_SOURCES, MAX_DOWNLOAD, assertSafeManifest, formatMiB, planImport, readZip, safeJoin } from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCES = join(ROOT, 'assets-src')
const usage = 'Usage: npm run assets:import -- --id <asset id> --file <path to the downloaded .zip or .glb>'

const { values } = parseArgs({ options: { id: { type: 'string' }, file: { type: 'string' }, help: { type: 'boolean', default: false } } })
if (values.help) {
  console.log(usage)
  process.exit(0)
}

try {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8'))
  assertSafeManifest(manifest)
  const entry = manifest.assets.find((asset) => asset.id === values.id)
  if (!values.id || !values.file) throw new Error(usage)
  if (!entry) throw new Error(`unknown asset id ${values.id}`)
  if (!ATTRIBUTED_SOURCES.includes(entry.source)) throw new Error(`${entry.id} comes from ${entry.source}: use npm run assets:fetch`)
  const size = statSync(values.file).size
  if (size > MAX_DOWNLOAD) throw new Error(`${values.file} is ${formatMiB(size)}, over the ${formatMiB(MAX_DOWNLOAD)} limit`)
  const data = readFileSync(values.file)
  const files = planImport(/\.glb$/i.test(values.file) ? new Map([[basename(values.file), data]]) : readZip(data))
  const folder = join(SOURCES, entry.id)
  rmSync(folder, { recursive: true, force: true })
  for (const file of files) {
    const target = safeJoin(folder, file.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.data)
  }
  const bytes = files.reduce((total, file) => total + file.data.length, 0)
  console.log(`${entry.id}: ${files.length} file(s), ${formatMiB(bytes)} unpacked into assets-src/${entry.id}/`)
} catch (error) {
  console.error(`assets:import failed: ${error.message}`)
  process.exit(1)
}
