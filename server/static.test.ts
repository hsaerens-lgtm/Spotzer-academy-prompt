// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, get, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { serveStatic } from './static.ts'

// Records every file stream the server opens, so the test can look at it after the client is gone.
const streams = vi.hoisted(() => [] as Readable[])
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    createReadStream: (...args: Parameters<typeof actual.createReadStream>) => {
      const stream = actual.createReadStream(...args)
      streams.push(stream)
      return stream
    },
  }
})

let server: Server
let dist: string

beforeEach(() => {
  streams.length = 0
  dist = mkdtempSync(join(tmpdir(), 'academy-static-'))
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  rmSync(dist, { recursive: true, force: true })
})

test('a download the client abandons closes the file stream instead of leaking its handle', async () => {
  writeFileSync(join(dist, 'big.bin'), Buffer.alloc(16 * 1024 * 1024))
  server = createServer((_req, res) => void serveStatic(dist, '/big.bin', res, 'GET'))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }

  await new Promise<void>((resolve) => {
    const request = get({ host: '127.0.0.1', port, path: '/big.bin' }, (response) => {
      response.on('error', () => {})
      response.once('data', () => {
        request.destroy()
        resolve()
      })
    })
    request.on('error', () => {})
  })

  expect(streams).toHaveLength(1)
  await vi.waitFor(() => expect(streams[0].destroyed).toBe(true), { timeout: 3000 })
})
