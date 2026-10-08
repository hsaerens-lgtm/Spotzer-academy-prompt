// Ported from Horn.os (owner's project): js/scene/city.js (buildClouds, buildBirds)
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Texture,
} from 'three'
import { appStore } from '../../../core/store'
import { tints } from '../../../three/tints'
import { useLightingApplier } from '../lighting/live'
import { OUTDOOR, seeded } from './cityPlan'
import { canvasTexture, disposeTree } from './resources'

/* Clouds: cumulus with flat, shaded bases, and high cirrus streaks. */

function cumulusTexture(seed: number) {
  return canvasTexture(512, 256, (g, w, h) => {
    const r = seeded(seed)
    const base = h * 0.72
    for (let i = 0; i < 60; i++) {
      const x = 70 + r() * 370
      const spread = 1 - Math.abs(x - 256) / 200
      const y = base - r() * 90 * Math.max(0.2, spread)
      const rad = 18 + r() * 42 * Math.max(0.3, spread)
      const grd = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad)
      grd.addColorStop(0, 'rgba(255,255,255,0.9)')
      grd.addColorStop(0.6, 'rgba(245,247,250,0.6)')
      grd.addColorStop(1, 'rgba(235,240,246,0)')
      g.fillStyle = grd
      g.beginPath()
      g.arc(x, y, rad, 0, Math.PI * 2)
      g.fill()
    }
    // shade the underside and cut it flat
    g.globalCompositeOperation = 'source-atop'
    const sh = g.createLinearGradient(0, base - 70, 0, base + 10)
    sh.addColorStop(0, 'rgba(160,172,190,0)')
    sh.addColorStop(1, 'rgba(150,162,182,0.75)')
    g.fillStyle = sh
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'destination-out'
    const cut = g.createLinearGradient(0, base, 0, base + 18)
    cut.addColorStop(0, 'rgba(0,0,0,0)')
    cut.addColorStop(1, 'rgba(0,0,0,1)')
    g.fillStyle = cut
    g.fillRect(0, base, w, h - base)
  })
}

function cirrusTexture(seed: number) {
  return canvasTexture(512, 128, (g, w, h) => {
    const r = seeded(seed)
    for (let i = 0; i < 90; i++) {
      const x = r() * w
      const y = h / 2 + (r() - 0.5) * 50
      g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`
      g.lineWidth = 2 + r() * 6
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + 60, y - 8 + r() * 16, x + 120 + r() * 80, y + (r() - 0.5) * 20)
      g.stroke()
    }
  })
}

function buildClouds() {
  const group = new Group()
  group.name = 'clouds'
  const r = seeded(31)
  const materials: MeshBasicMaterial[] = []
  const add = (texture: Texture, w: number, h: number, x: number, y: number, z: number, speed: number, opacity: number) => {
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false, opacity })
    material.userData.base = opacity
    materials.push(material)
    const mesh = new Mesh(new PlaneGeometry(w, h), material)
    mesh.position.set(x, y, z)
    mesh.rotation.y = Math.PI / 2
    mesh.userData.speed = speed
    group.add(mesh)
  }
  for (let i = 0; i < 16; i++) {
    const w = 60 + r() * 110
    add(cumulusTexture(100 + i), w, w * 0.5, -170 - r() * 200, 45 + r() * 70, -260 + r() * 520, 0.6 + r() * 1.2, 0.95)
  }
  for (let i = 0; i < 5; i++) add(cirrusTexture(200 + i), 260, 60, -360, 150 + r() * 40, -240 + r() * 480, 0.3, 0.8)
  return { group, materials }
}

/** Drifting clouds, tinted by the phase; still when the user asks for reduced motion. */
export function Clouds() {
  const clouds = useMemo(buildClouds, [])
  useEffect(() => () => disposeTree(clouds.group), [clouds])
  useLightingApplier((p) => {
    for (const material of clouds.materials) {
      material.color.copy(p.cloudColor)
      material.opacity = p.cloudOpacity * (material.userData.base as number)
    }
  })
  useFrame((_, delta) => {
    if (appStore.getState().reducedMotion) return
    const dt = Math.min(0.05, delta)
    for (const cloud of clouds.group.children) {
      cloud.position.z += (cloud.userData.speed as number) * dt
      if (cloud.position.z > OUTDOOR.cloudWrap) cloud.position.z = -OUTDOOR.cloudWrap
    }
  })
  return <primitive object={clouds.group} />
}

/* Birds: two small flocks crossing the sky by day. */

interface Flock {
  birds: Group[]
  x: number
  y: number
  z: number
  speed: number
}

function buildBirds() {
  const group = new Group()
  group.name = 'birds'
  const r = seeded(51)
  const material = new MeshBasicMaterial({ color: tints.city.bird, side: DoubleSide, fog: true })
  const wing = new BufferGeometry()
  wing.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0.9, 0.05, -0.15, 0.15, 0, 0.35], 3))
  const flocks: Flock[] = []
  for (let f = 0; f < 2; f++) {
    const flock: Flock = { birds: [], x: -60 - r() * 60, y: OUTDOOR.groundY + 40 + r() * 25, z: -150 + r() * 100, speed: 7 + r() * 3 }
    for (let i = 0; i < 7; i++) {
      const bird = new Group()
      const left = new Mesh(wing, material)
      const right = new Mesh(wing, material)
      right.scale.x = -1
      bird.add(left, right)
      bird.scale.setScalar(0.9)
      bird.userData = { left, right, off: new Vector3((r() - 0.5) * 4, (r() - 0.5) * 2, -Math.abs(i - 3) * 2.2), phase: r() * 6 }
      group.add(bird)
      flock.birds.push(bird)
    }
    flocks.push(flock)
  }
  const update = (t: number, dt: number) => {
    for (const flock of flocks) {
      flock.z += flock.speed * dt
      if (flock.z > 220) flock.z = -220
      for (const bird of flock.birds) {
        const u = bird.userData as { left: Mesh; right: Mesh; off: Vector3; phase: number }
        bird.position.set(flock.x + u.off.x, flock.y + u.off.y + Math.sin(t * 0.6 + u.phase) * 0.8, flock.z + u.off.z)
        const flap = Math.sin(t * 9 + u.phase) * 0.6
        u.left.rotation.z = flap
        u.right.rotation.z = -flap
      }
    }
  }
  update(0, 0)
  return { group, update }
}

/** Birds by day only, and never when the user asks for reduced motion. */
export function Birds() {
  const birds = useMemo(buildBirds, [])
  useEffect(() => () => disposeTree(birds.group), [birds])
  useLightingApplier((p) => {
    birds.group.visible = p.night < 0.6 && !appStore.getState().reducedMotion
  })
  useFrame(({ clock }, delta) => {
    if (birds.group.visible) birds.update(clock.elapsedTime, Math.min(0.05, delta))
  })
  return <primitive object={birds.group} />
}
