import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Texture,
} from 'three'
import { isTextured, markExempt, untexturedMeshes } from './audit'

const box = new BoxGeometry()
const textured = (name: string) => new MeshStandardMaterial({ name, map: new Texture(), roughnessMap: new Texture() })
const plain = (name = '') => new MeshStandardMaterial({ name })
/** An emissive material, as the 'emissive' exemption requires: the colour counts, the intensity (a light at rest) does not. */
const glowing = (name: string) => markExempt(new MeshStandardMaterial({ name, emissive: new Color(1, 1, 1), emissiveIntensity: 0 }), 'emissive')
function named<T extends { name: string }>(object: T, name: string): T {
  object.name = name
  return object
}

test('a textured mesh passes', () => {
  const root = named(new Group(), 'base')
  root.add(new Mesh(box, textured('oak')))
  root.add(new Mesh(box, new MeshStandardMaterial({ map: new Texture(), normalMap: new Texture() })))
  expect(untexturedMeshes(root)).toEqual([])
  expect(isTextured(textured('oak'))).toBe(true)
  expect(isTextured(new MeshStandardMaterial({ map: new Texture() }))).toBe(false)
  expect(isTextured(new MeshStandardMaterial({ roughnessMap: new Texture() }))).toBe(false)
})

test('an untextured mesh is reported with its path', () => {
  const root = named(new Group(), 'base')
  const table = named(new Group(), 'table')
  const anonymous = new Group()
  root.add(table)
  table.add(anonymous)
  anonymous.add(named(new Mesh(box, plain('oak')), 'top'))
  anonymous.add(new Mesh(box, plain()))
  root.add(named(new InstancedMesh(box, new MeshBasicMaterial(), 2), 'chairs'))
  expect(untexturedMeshes(root)).toEqual(['base/table/top#oak', 'base/table#MeshStandardMaterial', 'base/chairs#MeshBasicMaterial'])
})

test('an exempt material or ancestor is skipped', () => {
  const root = named(new Group(), 'base')
  root.add(named(new Mesh(box, markExempt(plain('glass'), 'glass')), 'pane'))
  const outdoor = markExempt(named(new Group(), 'outdoor'), 'sky')
  outdoor.add(named(new Mesh(box, plain('facade')), 'city'))
  root.add(outdoor)
  expect(untexturedMeshes(root)).toEqual([])
  const sky = markExempt(new Group(), 'sky')
  const inner = named(new Group(), 'inner')
  sky.add(inner)
  inner.add(new Mesh(box, plain('cloud')))
  expect(untexturedMeshes(inner)).toEqual([])
})

test('hidden meshes and hidden ancestors are skipped', () => {
  const root = named(new Group(), 'base')
  const hidden = named(new Mesh(box, plain('a')), 'hidden')
  hidden.visible = false
  const folder = named(new Group(), 'folder')
  folder.visible = false
  folder.add(new Mesh(box, plain('b')))
  root.add(hidden, folder)
  expect(untexturedMeshes(root)).toEqual([])
  const parent = new Group()
  parent.visible = false
  const child = named(new Group(), 'decor')
  parent.add(child)
  child.add(new Mesh(box, plain('c')))
  expect(untexturedMeshes(child)).toEqual([])
})

test('multi-material meshes are checked material by material', () => {
  const root = named(new Group(), 'base')
  root.add(named(new Mesh(box, [textured('wood'), plain('paint'), glowing('bulb')]), 'lamp'))
  expect(untexturedMeshes(root)).toEqual(['base/lamp#paint'])
})

test('a material that draws nothing is not reported', () => {
  const root = named(new Group(), 'base')
  const switchedOff = plain('off')
  switchedOff.visible = false
  const depthOnly = plain('occluder')
  depthOnly.colorWrite = false
  root.add(named(new Mesh(box, switchedOff), 'a'))
  root.add(named(new Mesh(box, depthOnly), 'b'))
  root.add(named(new Mesh(box, [depthOnly, plain('paint')]), 'c'))
  expect(untexturedMeshes(root)).toEqual(['base/c#paint'])
})

test('the emissive exemption needs an emissive colour', () => {
  const root = named(new Group(), 'base')
  root.add(named(new Mesh(box, glowing('lit')), 'bulb'))
  // Marked, but flat: a plate cannot hide behind the exemption. Same for a material type that has no emissive colour.
  root.add(named(new Mesh(box, markExempt(plain('flat'), 'emissive')), 'plate'))
  root.add(named(new Mesh(box, markExempt(new MeshBasicMaterial({ name: 'unlit' }), 'emissive')), 'sticker'))
  // The same goes for an ancestor marked emissive: only its emissive materials are exempt.
  const strip = markExempt(named(new Group(), 'strip'), 'emissive')
  strip.add(named(new Mesh(box, plain('bar')), 'bar'))
  strip.add(named(new Mesh(box, glowing('tube')), 'tube'))
  root.add(strip)
  // The other exemptions need no colour.
  root.add(named(new Mesh(box, markExempt(plain('pane'), 'glass')), 'pane'))
  root.add(markExempt(named(new Group(), 'backdrop'), 'sky').add(named(new Mesh(box, plain('cloud')), 'cloud')))
  expect(untexturedMeshes(root)).toEqual(['base/plate#flat', 'base/sticker#unlit', 'base/strip/bar#bar'])
})

test('a shader material is reported unless it is marked exempt', () => {
  const root = named(new Group(), 'base')
  root.add(named(new Mesh(box, new ShaderMaterial()), 'dome'))
  root.add(named(new Mesh(box, markExempt(new ShaderMaterial({ name: 'gradient' }), 'sky')), 'sky'))
  root.add(named(new Mesh(box, markExempt(new ShaderMaterial({ name: 'fake' }), 'emissive')), 'fake'))
  expect(untexturedMeshes(root)).toEqual(['base/dome#ShaderMaterial', 'base/fake#fake'])
})
