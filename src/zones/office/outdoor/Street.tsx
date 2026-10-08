// Ported from Horn.os (owner's project): js/scene/city.js (ground textures, buildTrees, buildStreet)
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Material,
} from 'three'
import { useSoftwareRenderer } from '../../../app/quality'
import { appStore } from '../../../core/store'
import { tints } from '../../../three/tints'
import { useLightingApplier } from '../lighting/live'
import { OUTDOOR, seeded } from './cityPlan'
import { canvasTexture, disposeTree } from './resources'
import { CAR_LIGHT_FRAGMENT, CAR_LIGHT_VERTEX, LAMP_GLOW_FRAGMENT, LAMP_GLOW_VERTEX } from './shaders'

const { groundY: GROUND_Y, streetX: STREET_X, park: PARK } = OUTDOOR

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

function paverTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = tints.city.paving
      g.fillRect(0, 0, w, h)
      const r = seeded(8)
      const pw = 64
      const ph = 32
      for (let y = 0; y < h; y += ph) {
        const off = (y / ph) % 2 ? pw / 2 : 0
        for (let x = -pw; x < w + pw; x += pw) {
          const v = 170 + r() * 30
          g.fillStyle = `rgb(${v},${v - 4},${v - 10})`
          g.fillRect(x + off + 2, y + 2, pw - 4, ph - 4)
        }
      }
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.08})`
        g.fillRect(r() * w, r() * h, 2, 2)
      }
    },
    { repeat: [8, 600] },
  )
}

function asphaltTexture() {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = tints.city.asphalt
      g.fillRect(0, 0, w, h)
      const r = seeded(12)
      for (let i = 0; i < 30000; i++) {
        const v = 40 + r() * 50
        g.fillStyle = `rgba(${v},${v},${v + 3},0.5)`
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
      }
      for (let i = 0; i < 12; i++) {
        g.fillStyle = `rgba(20,20,22,${0.15 + r() * 0.2})`
        g.fillRect(r() * w, r() * h, 30 + r() * 120, 20 + r() * 60)
      }
    },
    { repeat: [2, 90] },
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

function buildTrees(r: () => number) {
  const spots: [number, number, number][] = []
  for (const side of [-1, 1]) for (let z = -130; z < 130; z += 8 + r() * 3) spots.push([STREET_X + side * 6.8 + (r() - 0.5) * 0.6, z, 0.9 + r() * 0.35])
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

/* The street: road, pavements, park, trees, lamps, traffic. */

interface Car {
  dir: number
  lane: number
  z: number
  speed: number
  colour: string
}

function buildStreet() {
  const group = new Group()
  group.name = 'street'
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
  flat(9, 400, new MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.92 }), STREET_X, GROUND_Y, 0)
  const pavers = new MeshStandardMaterial({ map: paverTexture(), roughness: 0.95 })
  for (const side of [-1, 1]) flat(4, 400, pavers, STREET_X + side * 6.5, GROUND_Y + 0.12, 0)
  // kerbs
  const kerbMaterial = new MeshStandardMaterial({ color: tints.city.kerb, roughness: 0.9 })
  for (const side of [-1, 1]) {
    const kerb = new Mesh(new BoxGeometry(0.3, 0.14, 400), kerbMaterial)
    kerb.position.set(STREET_X + side * 4.6, GROUND_Y + 0.05, 0)
    group.add(kerb)
  }
  // the park: a gravel path, low hedges along its edge
  flat(3, 400, new MeshStandardMaterial({ map: gravelTexture(), roughness: 1 }), (PARK.x0 + PARK.x1) / 2, GROUND_Y + 0.01, 0, 0.12)
  const hedge = new Mesh(new BoxGeometry(1.1, 1.0, 400), new MeshStandardMaterial({ color: tints.city.hedge, roughness: 1 }))
  hedge.position.set(PARK.x0 - 3.2, GROUND_Y + 0.5, 0)
  group.add(hedge)
  // lane markings
  const dash = new InstancedMesh(new PlaneGeometry(0.15, 2.5).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: tints.city.laneMark }), 80)
  const m4 = new Matrix4()
  for (let i = 0; i < 80; i++) dash.setMatrixAt(i, m4.makeTranslation(STREET_X, GROUND_Y + 0.02, -200 + i * 5))
  group.add(dash)

  // Always built (the seeded draws of what follows stay the same); Street hides them without a GPU (see below).
  const trees = buildTrees(r)
  group.add(...trees)

  // Street lamps on the near pavement, with glows that come on in the evening.
  const lampPositions: Vector3[] = []
  for (let z = -100; z < 100; z += 18) lampPositions.push(new Vector3(STREET_X + 5, GROUND_Y, z + 4))
  const pole = new InstancedMesh(
    new CylinderGeometry(0.07, 0.1, 5.5, 6).translate(0, 2.75, 0),
    new MeshStandardMaterial({ color: tints.city.lampPole, roughness: 0.6 }),
    lampPositions.length,
  )
  lampPositions.forEach((p, i) => pole.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)))
  group.add(pole)
  const glowGeometry = new BufferGeometry()
  glowGeometry.setAttribute('position', new BufferAttribute(new Float32Array(lampPositions.flatMap((p) => [p.x - 0.4, p.y + 5.5, p.z])), 3))
  const glowUniforms = { uOn: { value: 0 }, uColor: { value: new Color(tints.city.lampGlow) }, uSize: { value: 1400 } }
  const glows = new Points(
    glowGeometry,
    new ShaderMaterial({
      uniforms: glowUniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: LAMP_GLOW_VERTEX,
      fragmentShader: LAMP_GLOW_FRAGMENT,
    }),
  )
  glows.frustumCulled = false
  group.add(glows)

  // Traffic: cars both ways, with headlights and tail lights.
  const N = 26
  const bodies = tints.city.carBodies
  const cars: Car[] = []
  for (let i = 0; i < N; i++) {
    const dir = i % 2 ? 1 : -1
    cars.push({ dir, lane: STREET_X + dir * -1.9, z: -180 + r() * 360, speed: 7 + r() * 6, colour: bodies[Math.floor(r() * bodies.length)] })
  }
  const body = new InstancedMesh(new BoxGeometry(1.8, 1.1, 4.2).translate(0, 0.75, 0), new MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 }), N)
  const cabin = new InstancedMesh(
    new BoxGeometry(1.6, 0.6, 2.2).translate(0, 1.55, -0.2),
    new MeshStandardMaterial({ color: tints.city.carCabin, roughness: 0.2, metalness: 0.6 }),
    N,
  )
  cars.forEach((car, i) => body.setColorAt(i, new Color(car.colour)))
  const lightUniforms: { uNight: { value: number }; uColor: { value: Color } }[] = []
  const lightMaterial = (colour: string) => {
    const uniforms = { uNight: { value: 0 }, uColor: { value: new Color(colour) } }
    lightUniforms.push(uniforms)
    return new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: CAR_LIGHT_VERTEX,
      fragmentShader: CAR_LIGHT_FRAGMENT,
    })
  }
  const heads = new InstancedMesh(new PlaneGeometry(1.5, 0.22).translate(0, 0.8, 2.12), lightMaterial(tints.city.headlight), N)
  const tails = new InstancedMesh(new PlaneGeometry(1.5, 0.18).rotateY(Math.PI).translate(0, 0.85, -2.12), lightMaterial(tints.city.taillight), N)
  group.add(body, cabin, heads, tails)
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  const unit = new Vector3(1, 1, 1)
  const place = () => {
    cars.forEach((car, i) => {
      q.setFromAxisAngle(up, car.dir > 0 ? 0 : Math.PI)
      m4.compose(new Vector3(car.lane, GROUND_Y, car.z), q, unit)
      body.setMatrixAt(i, m4)
      cabin.setMatrixAt(i, m4)
      heads.setMatrixAt(i, m4)
      tails.setMatrixAt(i, m4)
    })
    for (const mesh of [body, cabin, heads, tails]) mesh.instanceMatrix.needsUpdate = true
  }
  place()
  for (const mesh of [body, cabin, heads, tails, dash, pole]) mesh.frustumCulled = false

  return {
    group,
    trees,
    glowUniforms,
    lightUniforms,
    update(dt: number) {
      for (const car of cars) {
        car.z += car.dir * car.speed * dt
        if (car.z > 190) car.z = -190
        if (car.z < -190) car.z = 190
      }
      place()
    },
  }
}

/**
 * The street eight floors down: road, pavements, trees, the park; lamps and car lights come on with the night.
 * Without a GPU (the e2e browser), the trees stay hidden: their 6 000 alpha-tested foliage cards cost more than the
 * rest of the frame, and no journey looks at them.
 */
export function Street() {
  const street = useMemo(buildStreet, [])
  const software = useSoftwareRenderer()
  useEffect(() => () => disposeTree(street.group), [street])
  useLayoutEffect(() => {
    for (const tree of street.trees) tree.visible = !software
  }, [street, software])
  useLightingApplier((p) => {
    street.glowUniforms.uOn.value = Math.max(0, p.night * 1.1 - 0.1)
    for (const uniforms of street.lightUniforms) uniforms.uNight.value = p.night
  })
  useFrame((_, delta) => {
    // Traffic stands still when the user asks for reduced motion.
    if (!appStore.getState().reducedMotion) street.update(Math.min(0.05, delta))
  })
  return <primitive object={street.group} />
}
