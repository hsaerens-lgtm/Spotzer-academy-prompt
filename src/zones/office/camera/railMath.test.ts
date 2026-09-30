import { Vector3 } from 'three'
import { layout } from '../layout'
import {
  KEY_STEP,
  WHEEL_SENSITIVITY,
  clamp01,
  easeInOutCubic,
  lerpPose,
  makeRail,
  railKeyAction,
  wheelDelta,
} from './railMath'

const toArray = (v: Vector3) => v.toArray().map((n) => Number(n.toFixed(6)))

describe('rail', () => {
  const rail = makeRail(layout.rail)

  it('starts at the overview and ends at the presentation view', () => {
    expect(toArray(rail(0).position)).toEqual(layout.rail[0].position)
    expect(toArray(rail(1).target)).toEqual(layout.rail[2].target)
  })

  it('passes through the middle point', () => {
    expect(toArray(rail(0.5).position)).toEqual(layout.rail[1].position)
  })

  it('clamps outside 0..1', () => {
    expect(rail(-2).position.equals(rail(0).position)).toBe(true)
    expect(rail(3).position.equals(rail(1).position)).toBe(true)
  })

  it('writes into the vectors it is given', () => {
    const out = { position: new Vector3(), target: new Vector3() }
    expect(rail(0.25, out)).toBe(out)
  })
})

test('easing starts, ends and crosses the middle as expected', () => {
  expect(easeInOutCubic(0)).toBe(0)
  expect(easeInOutCubic(1)).toBe(1)
  expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
  expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
  expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
})

test('lerpPose interpolates position and target', () => {
  const from = { position: new Vector3(0, 0, 0), target: new Vector3(0, 0, -1) }
  const out = { position: new Vector3(), target: new Vector3() }
  lerpPose(from, { position: [2, 2, 2], target: [0, 0, -3] }, 0.5, out)
  expect(out.position.toArray()).toEqual([1, 1, 1])
  expect(out.target.toArray()).toEqual([0, 0, -2])
})

test('wheel up moves toward the presentation view, in pixels or lines', () => {
  expect(wheelDelta({ deltaY: -100, deltaMode: 0 })).toBeCloseTo(100 * WHEEL_SENSITIVITY)
  expect(wheelDelta({ deltaY: 100, deltaMode: 0 })).toBeCloseTo(-100 * WHEEL_SENSITIVITY)
  expect(wheelDelta({ deltaY: -3, deltaMode: 1 })).toBeCloseTo(48 * WHEEL_SENSITIVITY)
})

test('clamp01 and the keyboard step', () => {
  expect(clamp01(-1)).toBe(0)
  expect(clamp01(2)).toBe(1)
  expect(KEY_STEP).toBe(0.25)
})

describe('railKeyAction', () => {
  const key = (name: string, mods: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
    key: name,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  })
  const office = { zone: 'office', transition: null, expandOpen: false }

  it('maps the arrows, Home and End to rail moves', () => {
    expect(railKeyAction(key('ArrowUp'), office, false)).toEqual({ kind: 'nudge', delta: KEY_STEP })
    expect(railKeyAction(key('ArrowDown'), office, false)).toEqual({ kind: 'nudge', delta: -KEY_STEP })
    expect(railKeyAction(key('Home'), office, false)).toEqual({ kind: 'set', t: 0 })
    expect(railKeyAction(key('End'), office, false)).toEqual({ kind: 'set', t: 1 })
  })

  it('ignores other keys', () => {
    expect(railKeyAction(key('a'), office, false)).toBeNull()
    expect(railKeyAction(key('Enter'), office, false)).toBeNull()
  })

  it('yields while the expanded view is open', () => {
    expect(railKeyAction(key('ArrowUp'), { ...office, expandOpen: true }, false)).toBeNull()
    expect(railKeyAction(key('Home'), { ...office, expandOpen: true }, false)).toBeNull()
  })

  it('yields during a transition and outside the office', () => {
    const transition = { to: 'workshop', via: null, stage: 'fade' }
    expect(railKeyAction(key('ArrowUp'), { ...office, transition }, false)).toBeNull()
    expect(railKeyAction(key('ArrowUp'), { ...office, zone: 'workshop' }, false)).toBeNull()
  })

  it('yields when the event comes from an editable field', () => {
    expect(railKeyAction(key('ArrowDown'), office, true)).toBeNull()
    expect(railKeyAction(key('End'), office, true)).toBeNull()
  })

  it('keeps ctrl / alt / meta combinations for the browser', () => {
    expect(railKeyAction(key('Home', { ctrlKey: true }), office, false)).toBeNull()
    expect(railKeyAction(key('ArrowUp', { altKey: true }), office, false)).toBeNull()
    expect(railKeyAction(key('End', { metaKey: true }), office, false)).toBeNull()
  })
})
