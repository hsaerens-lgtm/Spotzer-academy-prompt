import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfig } from './config.ts'
import { loadBlocks } from './content.ts'
import { createHandler } from './http.ts'
import { callOpenAI } from './openai.ts'
import { createRateLimiter } from './rateLimit.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = readConfig(process.env)
const blocks = loadBlocks(join(root, 'content', 'en', 'workshop', 'blocks.json'))
const dist = join(root, 'dist')
const distDir = process.env.SERVE_DIST !== '0' && existsSync(join(dist, 'index.html')) ? dist : null

const handler = createHandler({
  config,
  blocks,
  call: (options) => callOpenAI(options),
  limiter: createRateLimiter({ perMinute: config.ratePerMinute, perDay: config.ratePerDay, globalPerDay: config.globalPerDay }),
  distDir,
  // Route, status and duration only: never the config, the key or what the visitor wrote.
  log: (entry) => console.log(JSON.stringify(entry)),
})

// The handler answers its own failures (a bare 500, logged without detail); this only guards its logger.
const server = createServer((req, res) => {
  handler(req, res).catch(() => res.destroy())
})

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${config.port} is already in use.` : error.message)
  process.exit(1)
})

// Every interface by default (production, behind its own reverse proxy); "npm run dev" sets HOST=127.0.0.1 so a
// development key can only be spent from this machine.
const host = config.host ?? undefined

server.listen(config.port, host, () => {
  const corrector = config.apiKey ? `corrector on (${config.model})` : 'corrector off: no OPENAI_API_KEY in .env.local'
  console.log(`Athena workshop server on http://${host ?? 'localhost'}:${config.port} - ${corrector}${distDir ? ', serving dist/' : ''}`)
})
