import { Color, OrthographicCamera, RectAreaLight, Vector3 } from 'three'
import { QUALITY_SETTINGS, type Quality } from '../../../app/quality'
import { PHASES } from '../../../core/phase'
import { GLAZING, ROOM, WALL_T, layout } from '../layout'
import { PRESETS, SUN_TARGET, mixPreset } from './presets'
import { RIG, crtGlowCandela, floorLampCandela, rigLights } from './rig'

/** Sun positions of the three phases and of the blends each transition passes through. */
function sunPositions(): { label: string; position: Vector3 }[] {
  return PHASES.flatMap((phase, i) => {
    const next = PHASES[(i + 1) % PHASES.length]
    return [0, 0.25, 0.5, 0.75].map((t) => ({ label: `${phase} to ${next} at ${t}`, position: mixPreset(PRESETS[phase], PRESETS[next], t).sunPosition }))
  })
}

const names = (quality: Quality) => rigLights(QUALITY_SETTINGS[quality]).map((light) => light.name)
const ALWAYS = ['sun', 'sky-fill', 'window-light', 'lamp-light', 'screen-glow', 'crt-glow', 'floor-lamp-light']

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
    expect(names(quality), quality).toContain('floor-lamp-light')
    expect(rigLights(QUALITY_SETTINGS[quality])).toEqual(rigLights({ ...QUALITY_SETTINGS[quality] }))
  }
  expect(names('high')).toContain('pendant-light')
  expect(rigLights.length).toBe(1)
})

// Review round 1: the lounge corner had no light at night; the CRT picture lights it, as a real one would.
test('the CRT glow shines from the TV picture onto the sofa', () => {
  const { position, target } = layout.lights.crt
  const tv = layout.objects.tv.position
  const sofa = layout.objects.sofa.position
  // Just in front of the picture (the TV faces -x), level with the TV.
  expect(tv[0] - position[0]).toBeGreaterThan(0)
  expect(tv[0] - position[0]).toBeLessThan(0.5)
  expect(position[2]).toBeCloseTo(tv[2])
  // Aimed at the sofa, which stays within the light's reach; a spot cone opens 90 degrees at most.
  expect(target[0]).toBeCloseTo(sofa[0])
  expect(target[2]).toBeCloseTo(sofa[2])
  expect(new Vector3(...target).distanceTo(new Vector3(...position))).toBeLessThan(RIG.crtGlow.distance)
  expect(RIG.crtGlow.angle).toBeLessThanOrEqual(Math.PI / 2)
  expect(rigLights(QUALITY_SETTINGS.low).find((light) => light.name === 'crt-glow')?.kind).toBe('spot')
})

// Review round 1 ruling: the CRT follows the night factor, so it adds nothing by day and lights the sofa at night.
test('the CRT glow is dark by day and strongest at night', () => {
  expect(crtGlowCandela(PRESETS.day)).toBe(0)
  expect(crtGlowCandela(PRESETS.sunset)).toBeCloseTo(PRESETS.sunset.night * RIG.crtGlow.candela)
  expect(crtGlowCandela(PRESETS.night)).toBe(RIG.crtGlow.candela)
  // About 7 cd at night: the sofa seats at 20 luma or more in the overview (measured on screenshots).
  expect(RIG.crtGlow.candela).toBeGreaterThanOrEqual(6)
  expect(RIG.crtGlow.candela).toBeLessThanOrEqual(8)
  // During a transition it follows the blend of the night factor.
  expect(crtGlowCandela(mixPreset(PRESETS.sunset, PRESETS.night, 0.5))).toBeCloseTo(((PRESETS.sunset.night + 1) / 2) * RIG.crtGlow.candela)
})

// Task 10b: the floor lamp beside the sofa follows the sideboard lamp's level (preset lampIntensity), with no constant term.
test('the floor lamp is dark by day, lit at sunset and brightest at night', () => {
  expect(floorLampCandela(PRESETS.day)).toBe(0)
  expect(floorLampCandela(PRESETS.sunset)).toBeGreaterThan(0)
  expect(floorLampCandela(PRESETS.night)).toBeGreaterThan(floorLampCandela(PRESETS.sunset))
  for (const phase of PHASES) expect(floorLampCandela(PRESETS[phase]), phase).toBeCloseTo(RIG.floorLamp.k * PRESETS[phase].lampIntensity)
  // During a transition it follows the blend.
  const half = (PRESETS.sunset.lampIntensity + PRESETS.night.lampIntensity) / 2
  expect(floorLampCandela(mixPreset(PRESETS.sunset, PRESETS.night, 0.5))).toBeCloseTo(RIG.floorLamp.k * half)
})

test('the floor lamp light is a warm point light on every tier, within reach of the sofa and the wall by the TV', () => {
  for (const quality of ['high', 'medium', 'low'] as const) {
    const lights = rigLights(QUALITY_SETTINGS[quality]).filter((light) => light.name === 'floor-lamp-light')
    expect(lights, quality).toEqual([{ name: 'floor-lamp-light', kind: 'point' }])
  }
  // Warm, in the family of the sideboard lamp.
  const colour = new Color(RIG.floorLamp.colour)
  expect(colour.r).toBeGreaterThan(colour.g)
  expect(colour.g).toBeGreaterThan(colour.b)
  const hue = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }).h
  expect(Math.abs(hue(RIG.floorLamp.colour) - hue(RIG.lamp.colour))).toBeLessThan(0.03)
  expect(RIG.floorLamp.decay).toBe(2)
  // The sofa seats (about 0.5 m up) and the right wall above the TV are inside its distance.
  const light = new Vector3(...layout.lights.floorLamp.position)
  const [sofaX, , sofaZ] = layout.objects.sofa.position
  const tvZ = layout.objects.tv.position[2]
  for (const point of [new Vector3(sofaX, 0.5, sofaZ), new Vector3(ROOM.x1, 1.3, tvZ)]) {
    expect(light.distanceTo(point), point.toArray().join(', ')).toBeLessThan(RIG.floorLamp.distance)
  }
})
