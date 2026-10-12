// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * Colour rule of the redesign: brand colours come from core/brand.ts, material tints from three/tints.ts, light, sky
 * and fog colours from the two lighting modules. No other file of the 3D code (tests included) writes a hex colour.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SCANNED = ['src/three', 'src/zones/office']
const ALLOWED = ['src/three/tints.ts', 'src/zones/office/lighting/presets.ts', 'src/zones/office/lighting/rig.ts', 'src/three/robot/face.ts']
/** #rgb, #rrggbb and 0xrrggbb, not followed by another letter or digit. */
const HEX_COLOUR = /#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z_])|\b0x[0-9a-f]{6}(?![0-9a-z_])/gi

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => `${dir}/${file.replaceAll('\\', '/')}`)
    .filter((file) => /\.tsx?$/.test(file))
}

test('colour literals live only in the tint and lighting modules', () => {
  const files = SCANNED.flatMap(sourceFiles)
  // The scan really reads the 3D code: a broken path would make it pass on nothing.
  expect(files).toContain('src/three/tints.ts')
  expect(files).toContain('src/zones/office/OfficeScene.tsx')
  const offenders: string[] = []
  for (const file of files.filter((f) => !ALLOWED.includes(f))) {
    readFileSync(join(ROOT, file), 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        for (const match of line.matchAll(HEX_COLOUR)) offenders.push(`${file}:${index + 1} ${match[0]}`)
      })
  }
  expect(offenders).toEqual([])
  // The allowed modules do hold the colours.
  expect(readFileSync(join(ROOT, 'src/three/tints.ts'), 'utf8')).toMatch(HEX_COLOUR)
})
