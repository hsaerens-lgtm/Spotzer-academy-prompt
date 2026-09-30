import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_BYTES = 1.5 * 1024 * 1024
const dist = 'dist'
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'))
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)
if (!entryKey) {
  console.error('No entry chunk found in dist/.vite/manifest.json')
  process.exit(1)
}

const files = new Set()
function collect(key) {
  const chunk = manifest[key]
  if (!chunk || files.has(chunk.file)) return
  files.add(chunk.file)
  for (const imported of chunk.imports ?? []) collect(imported)
}
collect(entryKey)

let total = 0
for (const file of files) total += gzipSync(readFileSync(join(dist, file))).length
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)
console.log(`Initial JS (gzip): ${mb(total)} MB / budget ${mb(BUDGET_BYTES)} MB`)
if (total > BUDGET_BYTES) {
  console.error('Bundle budget exceeded')
  process.exit(1)
}
