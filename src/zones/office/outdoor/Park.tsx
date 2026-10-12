// Ported from Horn.os (owner's project): js/scene/city.js (ground textures, buildTrees, buildStreet)
import { useEffect, useLayoutEffect, useMemo } from 'react'
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Material,
} from 'three'
import { useSoftwareRenderer } from '../../../app/quality'
import { tints } from '../../../three/tints'
import { OUTDOOR, seeded } from './cityPlan'
import { canvasTexture, disposeTree } from './resources'

const { groundY: GROUND_Y, park: PARK } = OUTDOOR

/* Ground textures, painted. */

function grassTexture() {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = tints.city.grass
      g.fillRect(0, 0, w, h)
      const r = seeded(3)
      for (let i = 0; i < 60; i++) {
        const grd = g.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 40 + r() * 90)
        grd.addColorStop(0, `rgba(${r() < 0.5 ? '90,120,60' : '120,140,70'},0.35)`)
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grd
        g.fillRect(0, 0, w, h)
      }
      for (let i = 0; i < 26000; i++) {
        const v = r()
        g.fillStyle = v < 0.33 ? 'rgba(60,90,40,0.5)' : v < 0.66 ? 'rgba(140,165,85,0.45)' : 'rgba(100,130,60,0.5)'
        g.fillRect(r() * w, r() * h, 1, 2 + r() * 3)
      }
    },
    { repeat: [120, 120] },
  )
}

function gravelTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = tints.city.gravel
      g.fillRect(0, 0, w, h)
      const r = seeded(15)
      for (let i = 0; i < 9000; i++) {
        const v = 150 + r() * 70
        g.fillStyle = `rgba(${v},${v - 10},${v - 30},0.6)`
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
      }
    },
    { repeat: [2, 160] },
  )
}

/* Trees: trunk, branches, and cards of painted leaves. */

function foliageTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = seeded(21)
    const cx = w / 2
    const cy = h / 2
    const greens = [
      [78, 112, 52],
      [96, 132, 60],
      [62, 96, 44],
      [110, 142, 70],
    ]
    for (let i = 0; i < 4200; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * (w * 0.44)
      const x = cx + Math.cos(a) * d
      const y = cy + Math.sin(a) * d * 0.9
      const shade = 0.55 + 0.45 * (1 - y / h) * (0.7 + 0.3 * r()) // lighter on top
      const base = greens[Math.floor(r() * 4)]
      g.fillStyle = `rgb(${Math.round(base[0] * shade)},${Math.round(base[1] * shade)},${Math.round(base[2] * shade)})`
      g.save()
      g.translate(x, y)
      g.rotate(r() * Math.PI)
      g.beginPath()
      g.ellipse(0, 0, 7 + r() * 7, 3.5 + r() * 3.5, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  })
}

/** The park's trees (Horn buildTrees without the two street rows, which no camera sees). */
function buildTrees(r: () => number) {
  const spots: [number, number, number][] = []
  for (let i = 0; i < 150; i++) spots.push([PARK.x0 - 3 - r() * (PARK.x0 - PARK.x1 - 6), -150 + r() * 300, 0.8 + r() * 0.6])

  const trunkGeometry = new CylinderGeometry(0.12, 0.24, 5, 8).translate(0, 2.5, 0)
  const branchGeometry = new CylinderGeometry(0.03, 0.09, 2.6, 6).translate(0, 1.3, 0)
  const cardGeometry = new PlaneGeometry(1, 1)
  const trunks: Matrix4[] = []
  const branches: Matrix4[] = []
  const cards: Matrix4[] = []
  const cardTint: number[] = []
  const q = new Quaternion()
  const e = new Euler()
  for (const [x, z, s] of spots) {
    trunks.push(new Matrix4().compose(new Vector3(x, GROUND_Y, z), q.identity(), new Vector3(s, s, s)))
    const crown = new Vector3(x, GROUND_Y + 6.6 * s, z)
    for (let k = 0; k < 4; k++) {
      e.set(0.55 + r() * 0.35, r() * Math.PI * 2, 0, 'YXZ')
      branches.push(new Matrix4().compose(new Vector3(x, GROUND_Y + (3.4 + r() * 1.2) * s, z), new Quaternion().setFromEuler(e), new Vector3(s, s, s)))
    }
    for (let k = 0; k < 30; k++) {
      // points in a squashed ellipsoid, denser towards the outside
      const a = r() * Math.PI * 2
      const up = r() * 2 - 1
      const rad = 0.55 + 0.45 * Math.sqrt(r())
      const dir = new Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up))
      const p = crown.clone().add(new Vector3(dir.x * 2.4 * s * rad, dir.y * 1.8 * s * rad, dir.z * 2.4 * s * rad))
      e.set((r() - 0.5) * 1.2, r() * Math.PI * 2, (r() - 0.5) * 0.6, 'YXZ')
      const size = (1.7 + r() * 1.1) * s
      cards.push(new Matrix4().compose(p, new Quaternion().setFromEuler(e), new Vector3(size, size, size)))
      // darker inside and underneath: a cheap ambient occlusion
      cardTint.push(0.62 + 0.38 * (0.5 + 0.5 * dir.y) * (0.7 + 0.3 * rad) + (r() - 0.5) * 0.1)
    }
  }
  const bark = new MeshStandardMaterial({ color: tints.city.trunk, roughness: 1 })
  const trunkMesh = new InstancedMesh(trunkGeometry, bark, trunks.length)
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m))
  const branchMesh = new InstancedMesh(branchGeometry, bark, branches.length)
  branches.forEach((m, i) => branchMesh.setMatrixAt(i, m))
  const leaves = new MeshStandardMaterial({ map: foliageTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.9 })
  const cardMesh = new InstancedMesh(cardGeometry, leaves, cards.length)
  const c = new Color()
  cards.forEach((m, i) => {
    cardMesh.setMatrixAt(i, m)
    cardMesh.setColorAt(i, c.setRGB(cardTint[i], cardTint[i] * (0.98 + r() * 0.06), cardTint[i] * 0.95))
  })
  for (const mesh of [trunkMesh, branchMesh, cardMesh]) mesh.frustumCulled = false
  return [trunkMesh, branchMesh, cardMesh]
}

/* The ground: the park across the street, and the grass under the city. */

function buildPark() {
  const group = new Group()
  group.name = 'park'
  const r = seeded(19)
  const flat = (w: number, d: number, material: Material, x: number, y: number, z: number, rotZ = 0) => {
    const mesh = new Mesh(new PlaneGeometry(w, d), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = rotZ
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }

  flat(900, 900, new MeshStandardMaterial({ map: grassTexture(), roughness: 1 }), -200, GROUND_Y - 0.02, 0)
  // a gravel path across the park
  flat(3, 400, new MeshStandardMaterial({ map: gravelTexture(), roughness: 1 }), (PARK.x0 + PARK.x1) / 2, GROUND_Y + 0.01, 0, 0.12)
  group.add(...buildTrees(r))
  return group
}

/**
 * The ground eight floors down, as far as the glazing shows it: the park across the street (lawn, gravel path,
 * trees) and the grass under the city. The street itself (road, pavements, lamps, traffic) lies below the sightline
 * of every camera pose, so it is not built.
 * Without a GPU (the e2e browser), the whole park stays hidden: its 4 500 alpha-tested foliage cards and the lit lawn
 * seen through the glazing cost more than the rest of the frame, and no journey looks at them. The sky dome's
 * horizon colour shows below the city instead.
 */
export function Park() {
  const park = useMemo(buildPark, [])
  const software = useSoftwareRenderer()
  useEffect(() => () => disposeTree(park), [park])
  useLayoutEffect(() => {
    park.visible = !software
  }, [park, software])
  return <primitive object={park} />
}
