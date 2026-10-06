import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
}

function plain(res: ServerResponse, status: number, text: string): number {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
  res.end(text)
  return status
}

/** Serves one file of the built site. Returns the status sent. */
export async function serveStatic(distDir: string, pathname: string, res: ServerResponse, method: string): Promise<number> {
  const root = resolve(distDir)
  let path: string
  try {
    path = decodeURIComponent(pathname)
  } catch {
    return plain(res, 400, 'Bad request')
  }
  if (path.endsWith('/')) path += 'index.html'
  const file = resolve(root, `.${path}`)
  if (file !== root && !file.startsWith(root + sep)) return plain(res, 403, 'Forbidden')
  let size: number
  try {
    const info = await stat(file)
    if (!info.isFile()) return plain(res, 404, 'Not found')
    size = info.size
  } catch {
    return plain(res, 404, 'Not found')
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (method === 'HEAD') {
    res.end()
    return 200
  }
  // The file can vanish between stat and open: drop the connection rather than crash on an unhandled stream error.
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res)
  return 200
}
