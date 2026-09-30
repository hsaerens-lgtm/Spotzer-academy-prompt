import type { ThreeElements } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, LatheGeometry, SRGBColorSpace, type Group } from 'three'
import type { Gesture, Mood } from '../../content/schema'
import { HoverOutline } from '../interactive'
import { logoBoxes } from '../logo'
import { materials } from '../materials'
import { FACE_H, FACE_W, drawFace, eyeShapes, faceKey } from './face'
import { ADA, HEAD_Y, VISOR, bodyProfile, bodyRadiusAt } from './geometry'
import { BLINK_SECONDS, NEUTRAL_POSE, gesturePose, hoverY, nextBlinkDelay } from './motion'

export interface AdaProps extends Omit<ThreeElements['group'], 'ref'> {
  mood: Mood
  gesture: Gesture
  /** Change this number to (re)start the gesture. */
  gestureKey: number
  speaking: boolean
  reducedMotion: boolean
  /** Where the eyes look, -1..1 (y up). Defaults to the mouse pointer. */
  lookAt?: { x: number; y: number }
}

function createFace() {
  const canvas = document.createElement('canvas')
  canvas.width = FACE_W
  canvas.height = FACE_H
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { ctx: canvas.getContext('2d')!, texture, key: '' }
}

function createHalo() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(88, 252, 115, 0.9)')
  gradient.addColorStop(1, 'rgba(88, 252, 115, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Arm() {
  const m = materials()
  return (
    <mesh position-y={-ADA.armLength / 2} scale={[0.055, ADA.armLength / 2, 0.085]} material={m.porcelain} castShadow>
      <sphereGeometry args={[1, 24, 16]} />
    </mesh>
  )
}

function ChestLogo() {
  const m = materials()
  const byColor = { lime: m.lime, mint: m.mint, ink: m.ink }
  const z = bodyRadiusAt(ADA.chestY) + 0.002
  return (
    <group position={[0, ADA.chestY, z]}>
      {logoBoxes(0.0011).map((box, index) => (
        <mesh key={index} position={[box.position[0], box.position[1], 0]} material={byColor[box.color]}>
          <boxGeometry args={[box.size[0], box.size[1], 0.006]} />
        </mesh>
      ))}
    </group>
  )
}

export function Ada({ mood, gesture, gestureKey, speaking, reducedMotion, lookAt, ...group }: AdaProps) {
  const m = materials()
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const armPX = useRef<Group>(null)
  const armNX = useRef<Group>(null)
  const bodyGeometry = useMemo(() => new LatheGeometry(bodyProfile(), 48), [])
  const face = useMemo(createFace, [])
  const halo = useMemo(createHalo, [])
  const gestureStart = useRef({ key: Number.NaN, at: 0 })
  const blink = useRef({ next: 2, until: 0 })
  const look = useRef({ x: 0, y: 0 })

  useEffect(
    () => () => {
      bodyGeometry.dispose()
      face.texture.dispose()
      halo.dispose()
    },
    [bodyGeometry, face, halo],
  )

  useFrame((state, delta) => {
    if (!body.current || !head.current || !armPX.current || !armNX.current) return
    const time = state.clock.elapsedTime
    if (gestureStart.current.key !== gestureKey) gestureStart.current = { key: gestureKey, at: time }
    const pose = reducedMotion ? NEUTRAL_POSE : gesturePose(gesture, time - gestureStart.current.at)
    const idle = reducedMotion ? 0 : Math.sin(time * 1.4) * 0.04

    body.current.position.y = (reducedMotion ? 0 : hoverY(time)) + pose.bob
    body.current.rotation.y = pose.bodyYaw + pose.spin
    armPX.current.rotation.z = pose.armPX + idle
    armNX.current.rotation.z = -pose.armNX - idle

    const goal = lookAt ?? state.pointer
    easing.damp(look.current, 'x', goal.x, 0.35, delta)
    easing.damp(look.current, 'y', goal.y, 0.35, delta)
    head.current.rotation.set(-look.current.y * 0.12 + pose.headNod, look.current.x * 0.25, pose.headTilt)

    if (time > blink.current.next) {
      blink.current.until = time + BLINK_SECONDS
      blink.current.next = time + nextBlinkDelay(Math.random)
    }
    const shapes = eyeShapes(mood, time < blink.current.until)
    const pulse = speaking && !reducedMotion ? 0.5 + 0.5 * Math.sin(time * 18) : 0
    const key = faceKey(shapes, look.current.x, look.current.y, pulse, time)
    if (key !== face.key) {
      drawFace(face.ctx, shapes, { lookX: look.current.x, lookY: look.current.y, pulse, time })
      face.texture.needsUpdate = true
      face.key = key
    }
  })

  return (
    <group {...group}>
      <group ref={body}>
        <mesh geometry={bodyGeometry} material={m.porcelain} castShadow>
          <HoverOutline />
        </mesh>
        <mesh position-y={ADA.beltY} rotation-x={Math.PI / 2} material={m.mint}>
          <torusGeometry args={[bodyRadiusAt(ADA.beltY) + 0.002, 0.005, 8, 64]} />
        </mesh>
        <ChestLogo />
        <group ref={head} position-y={HEAD_Y}>
          <mesh scale={[1, 0.85, 0.95]} material={m.porcelain} castShadow>
            <sphereGeometry args={[ADA.headRadius, 48, 32]} />
            <HoverOutline />
          </mesh>
          <mesh scale={[1, 0.85, 0.95]}>
            <sphereGeometry
              args={[ADA.headRadius * 1.015, 48, 24, VISOR.phiStart, VISOR.phiLength, VISOR.thetaStart, VISOR.thetaLength]}
            />
            <meshPhysicalMaterial
              color="#050607"
              roughness={0.1}
              clearcoat={1}
              emissive="#ffffff"
              emissiveMap={face.texture}
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        </group>
        <group ref={armPX} position={[ADA.armX, ADA.armY, 0]}>
          <Arm />
        </group>
        <group ref={armNX} position={[-ADA.armX, ADA.armY, 0]}>
          <Arm />
        </group>
      </group>
      <mesh position-y={-0.02} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.3, 48]} />
        <meshBasicMaterial map={halo} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}
