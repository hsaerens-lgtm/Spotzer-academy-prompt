import { Vector3 } from 'three'
import { layout } from '../layout'
import { KEY_STEP, WHEEL_SENSITIVITY, clamp01, easeInOutCubic, lerpPose, makeRail, wheelDelta } from './railMath'

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
