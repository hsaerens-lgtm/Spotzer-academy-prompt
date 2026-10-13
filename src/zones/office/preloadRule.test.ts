// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * No preloading at module level (spec section 8: reading mode loads no 3D asset). The base stage's downloads start in
 * preloadBaseAssets(), which the 3D stage calls when it mounts (Task 16b); no other file of the site preloads.
 */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

test('preloadBaseAssets is the only place in the site that preloads', () => {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .map((file) => `src/${file.replaceAll('\\', '/')}`)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  // The scan really reads the site: a broken path would make it pass on nothing.
  expect(files).toContain('src/zones/office/OfficeScene.tsx')
  const preloading = files.filter((file) => /\.preload\s*\(/.test(readFileSync(join(ROOT, file), 'utf8')))
  expect(preloading).toEqual(['src/zones/office/baseAssets.ts'])
})
