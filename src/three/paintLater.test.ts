import { DataTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { paintLater, paintPending } from './paintLater'

/*
 * Canvas textures painted once the programs are queued (Task 16b): three compiles a program from the presence of a
 * map, not from its pixels, so the painting can wait while the GPU compiles instead of delaying the compile.
 */

const texture = () => new DataTexture(new Uint8Array(4), 1, 1)

test('a texture painted later stays as it is until a root that uses it is painted, then is painted once for upload', () => {
  const paint = vi.fn()
  const map = paintLater(texture(), paint)
  const root = new Group().add(new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map })))
  expect(paint).not.toHaveBeenCalled()
  const version = map.version
  paintPending(root)
  expect(paint).toHaveBeenCalledTimes(1)
  // Uploaded again if three had uploaded the blank canvas before.
  expect(map.version).toBe(version + 1)
  paintPending(root)
  expect(paint).toHaveBeenCalledTimes(1)
})

test('only the textures of the materials under the root are painted, hidden objects and every map slot included', () => {
  const inside = vi.fn()
  const outside = vi.fn()
  const hidden = new Mesh(new PlaneGeometry(), [new MeshStandardMaterial(), new MeshStandardMaterial({ alphaMap: paintLater(texture(), inside) })])
  hidden.visible = false
  const root = new Group().add(hidden)
  new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: paintLater(texture(), outside) }))
  paintPending(root)
  expect(inside).toHaveBeenCalledTimes(1)
  expect(outside).not.toHaveBeenCalled()
})
