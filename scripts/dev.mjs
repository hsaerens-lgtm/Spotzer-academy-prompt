// Development: Vite (the site) and the corrector proxy together. Extra arguments go to Vite (e.g. --port, --open).
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { parseEnv } from 'node:util'
import { readConfig } from '../server/config.ts'

const require = createRequire(import.meta.url)
const vitePackage = require.resolve('vite/package.json')
const viteBin = join(dirname(vitePackage), JSON.parse(readFileSync(vitePackage, 'utf8')).bin.vite)

// The port the proxy will listen on: the shell wins over .env.local, as it does for the proxy itself.
const ENV_FILE = '.env.local'
const hasEnvFile = existsSync(ENV_FILE)
const port = readConfig({ PORT: process.env.PORT ?? (hasEnvFile ? parseEnv(readFileSync(ENV_FILE, 'utf8')).PORT : undefined) }).port

// "node --watch" never exits when its port is taken, so ask first: a busy port means the site runs alone.
// Both the proxy's own address (all of them) and 127.0.0.1 are tried: Windows lets an app bound to 127.0.0.1 share the port with a wildcard listener.
const isPortFree = (candidate, host) =>
  new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen({ port: candidate, host }, () => probe.close(() => resolve(true)))
  })

let stopping = false
let proxy = null
if ((await isPortFree(port)) && (await isPortFree(port, '127.0.0.1'))) {
  proxy = spawn(process.execPath, [...(hasEnvFile ? [`--env-file=${ENV_FILE}`] : []), '--watch', 'server/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, SERVE_DIST: '0' },
  })
  proxy.on('exit', (code) => {
    if (!stopping && code) console.warn('[dev] The corrector proxy stopped. The site keeps running; the corrector will show as offline.')
  })
} else {
  console.warn(`[dev] Port ${port} is already in use, so the corrector proxy was not started. The site keeps running; the corrector will show as offline.`)
}

// Vite forwards /api to that same port (see vite.config.ts).
const vite = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, PORT: String(port) } })
vite.on('exit', (code) => {
  stopping = true
  proxy?.kill()
  process.exit(code ?? 0)
})

const stop = () => {
  stopping = true
  proxy?.kill()
  vite.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
