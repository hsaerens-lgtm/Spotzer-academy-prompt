import { OrthographicCamera, RectAreaLight, Vector3 } from 'three'
import { QUALITY_SETTINGS, type Quality } from '../../../app/quality'
import { PHASES } from '../../../core/phase'
import { GLAZING, ROOM, WALL_T } from '../layout'
import { PRESETS, SUN_TARGET, mixPreset } from './presets'
import { RIG, rigLights } from './rig'

/** Sun positions of the three phases and of the blends each transition passes through. */
function sunPositions(): { label: string; position: Vector3 }[] {
  return PHASES.flatMap((phase, i) => {
    const next = PHASES[(i + 1) % PHASES.length]
    return [0, 0.25, 0.5, 0.75].map((t) => ({ label: `${phase} to ${next} at ${t}`, position: mixPreset(PRESETS[phase], PRESETS[next], t).sunPosition }))
  })
}

const names = (quality: Quality) => rigLights(QUALITY_SETTINGS[quality]).map((light) => light.name)
const ALWAYS = ['sun', 'sky-fill', 'window-light', 'lamp-light', 'screen-glow']

test('every preset sends the sun through the glazing', () => {
  for (const { label, position } of sunPositions()) {
    expect(position.x, label).toBeLessThan(GLAZING.side.x) // outside the facade
    // Where the ray from the sun to the table centre crosses the facade plane.
    const t = (GLAZING.side.x - position.x) / (SUN_TARGET.x - position.x)
    const y = position.y + (SUN_TARGET.y - position.y) * t
    const z = position.z + (SUN_TARGET.z - position.z) * t
    expect(y, label).toBeGreaterThan(0)
    expect(y, label).toBeLessThan(ROOM.height)
    expect(z, label).toBeGreaterThan(GLAZING.side.z0)
    expect(z, label).toBeLessThan(GLAZING.side.z1)
  }
})

test('the shadow camera holds the whole room for every sun position', () => {
  // The shell with its walls and slabs: everything that casts a shadow inside.
  const corners: Vector3[] = []
  for (const x of [ROOM.x0 - WALL_T, ROOM.x1 + WALL_T]) {
    for (const y of [-WALL_T / 2, ROOM.height + WALL_T / 2]) {
      for (const z of [ROOM.z0 - WALL_T, ROOM.z1 + WALL_T]) corners.push(new Vector3(x, y, z))
    }
  }
  const { left, right, top, bottom, near, far } = RIG.sun.camera
  for (const { label, position } of sunPositions()) {
    // As DirectionalLightShadow does: an orthographic camera at the light, looking at its target.
    const camera = new OrthographicCamera(left, right, top, bottom, near, far)
    camera.position.copy(position)
    camera.lookAt(SUN_TARGET)
    camera.updateMatrixWorld()
    for (const corner of corners) {
      const p = corner.clone().applyMatrix4(camera.matrixWorldInverse)
      expect(p.x, label).toBeGreaterThan(left)
      expect(p.x, label).toBeLessThan(right)
      expect(p.y, label).toBeGreaterThan(bottom)
      expect(p.y, label).toBeLessThan(top)
      expect(-p.z, label).toBeGreaterThan(near)
      expect(-p.z, label).toBeLessThan(far)
    }
  }
})

test('the window light covers the fa\u00e7ade', () => {
  const { position, lookAt, width, height } = RIG.window
  expect(width).toBeCloseTo(GLAZING.side.z1 - GLAZING.side.z0) // 10.4 m
  expect(height).toBe(ROOM.height)
  expect(position[1]).toBeCloseTo(ROOM.height / 2)
  expect(position[2]).toBeCloseTo((GLAZING.side.z0 + GLAZING.side.z1) / 2)
  expect(position[0] - GLAZING.side.x).toBeGreaterThan(0) // just inside the glass
  expect(position[0] - GLAZING.side.x).toBeLessThan(0.05)
  // Turned as Lights.tsx turns it: it shines into the room (lights shine along their local -z), its width along the facade.
  const light = new RectAreaLight()
  light.position.set(...position)
  light.lookAt(...lookAt)
  expect(new Vector3(0, 0, -1).applyQuaternion(light.quaternion).x).toBeCloseTo(1)
  expect(Math.abs(new Vector3(1, 0, 0).applyQuaternion(light.quaternion).z)).toBeCloseTo(1)
})

test('accent lights exist only on the high tier', () => {
  expect(names('high')).toEqual([...ALWAYS, 'ceiling-light-0', 'ceiling-light-1', 'pendant-light'])
  expect(names('medium')).toEqual(ALWAYS)
  expect(names('low')).toEqual(ALWAYS)
  // One shadow caster: the only directional light.
  expect(rigLights(QUALITY_SETTINGS.high).filter((light) => light.kind === 'directional').map((light) => light.name)).toEqual(['sun'])
})

test('the light count never depends on the phase', () => {
  // Lights a phase switches off stay mounted at intensity 0: adding or removing a light would recompile every
  // material in the middle of a transition. rigLights only takes the quality settings.
  expect(PRESETS.day.lampIntensity).toBe(0)
  expect(PRESETS.day.ceiling).toBe(0)
  for (const quality of ['high', 'medium', 'low'] as const) {
    expect(names(quality), quality).toContain('lamp-light')
    expect(rigLights(QUALITY_SETTINGS[quality])).toEqual(rigLights({ ...QUALITY_SETTINGS[quality] }))
  }
  expect(names('high')).toContain('pendant-light')
  expect(rigLights.length).toBe(1)
})
