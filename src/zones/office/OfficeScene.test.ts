// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SOURCE = readFileSync(fileURLToPath(new URL('./OfficeScene.tsx', import.meta.url)), 'utf8')

test('the fog is a direct child of the scene, beside its background', () => {
  // An attach="fog" inside a group would attach to that group, and the renderer would never see it.
  const start = SOURCE.indexOf('return (')
  const fog = SOURCE.indexOf('<fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />')
  expect(start).toBeGreaterThan(-1)
  expect(fog).toBeGreaterThan(start)
  const before = SOURCE.slice(start, fog)
  // Before the fog the JSX opens the root fragment only: every element in between closes itself.
  expect(before).toContain('<>')
  const opened = [...before.matchAll(/<([A-Za-z][\w.]*)\b[^>]*>/g)].filter((tag) => !tag[0].endsWith('/>'))
  expect(opened.map((tag) => tag[1])).toEqual([])
  expect(before).toContain('<color attach="background"')
})
