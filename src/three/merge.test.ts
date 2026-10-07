import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Matrix4 } from 'three'
import { at, mergeParts } from './merge'

test('mergeParts joins indexed and non-indexed parts', () => {
  const indexed = new BoxGeometry(1, 1, 1)
  const flat = new BoxGeometry(1, 1, 1).toNonIndexed()
  expect(indexed.index).not.toBeNull()
  const merged = mergeParts([{ geometry: indexed }, { geometry: flat, matrix: at(2, 0, 0) }])
  expect(merged.index).toBeNull()
  expect(merged.getAttribute('position').count).toBe(72)
})

test('mergeParts keeps only position, normal and uv', () => {
  const box = new BoxGeometry(1, 1, 1)
  box.setAttribute('color', new BufferAttribute(new Float32Array(box.getAttribute('position').count * 3), 3))
  box.setAttribute('uv1', box.getAttribute('uv').clone())
  // A triangle with neither normals nor UVs: they are added (computed normals, zero UVs).
  const bare = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
  const merged = mergeParts([{ geometry: box }, { geometry: bare }])
  expect(Object.keys(merged.attributes).sort()).toEqual(['normal', 'position', 'uv'])
  const uv = merged.getAttribute('uv')
  expect([uv.getX(uv.count - 1), uv.getY(uv.count - 1)]).toEqual([0, 0])
  const normal = merged.getAttribute('normal')
  expect(normal.getZ(normal.count - 1)).toBeCloseTo(1)
})

test('mergeParts bakes one colour per part when asked', () => {
  const red = new Color(1, 0, 0)
  const merged = mergeParts(
    [{ geometry: new BoxGeometry(), colour: red }, { geometry: new BoxGeometry() }],
    { colours: true },
  )
  const colour = merged.getAttribute('color')
  expect(colour.count).toBe(72)
  expect([colour.getX(0), colour.getY(0), colour.getZ(0)]).toEqual([1, 0, 0])
  expect([colour.getX(35), colour.getY(35), colour.getZ(35)]).toEqual([1, 0, 0])
  expect([colour.getX(36), colour.getY(36), colour.getZ(36)]).toEqual([1, 1, 1])
  expect(mergeParts([{ geometry: new BoxGeometry(), colour: red }]).hasAttribute('color')).toBe(false)
})

test('mergeParts refuses an empty list', () => {
  expect(() => mergeParts([])).toThrow('mergeParts needs at least one part')
})

test('mergeParts drops groups: the result is for one material', () => {
  const box = new BoxGeometry(1, 1, 1)
  expect(box.groups.length).toBeGreaterThan(0)
  expect(mergeParts([{ geometry: box }, { geometry: new BoxGeometry(1, 1, 1) }]).groups).toEqual([])
})

test('mergeParts leaves its inputs untouched', () => {
  const box = new BoxGeometry(1, 1, 1)
  const before = Array.from(box.getAttribute('position').array)
  const merged = mergeParts([{ geometry: box, matrix: at(1, 2, 3, [0, Math.PI / 2, 0], 2) }])
  expect(Array.from(box.getAttribute('position').array)).toEqual(before)
  expect(box.index).not.toBeNull()
  merged.computeBoundingBox()
  const corners = [...merged.boundingBox!.min.toArray(), ...merged.boundingBox!.max.toArray()]
  corners.forEach((n, i) => expect(n).toBeCloseTo([0, 1, 2, 2, 3, 4][i]))
  expect(at(1, 2, 3).equals(new Matrix4().makeTranslation(1, 2, 3))).toBe(true)
})
