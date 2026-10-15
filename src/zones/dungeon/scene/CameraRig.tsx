import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { PointLight } from 'three'
import { useApp } from '../../../core/store'
import { DELTA, type Dir } from '../../../dungeon/movement'
import { useDungeon } from '../store'

export const STEP_MS = 180
const BUMP_MS = 120
const EYE = 0.5
/** Camera yaw for each direction: three.js cameras look down -z, which is north on the map. */
const YAW: Record<Dir, number> = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 }

const ease = (t: number) => t * t * (3 - 2 * t)
/** The shortest way round from one yaw to another. */
const shortest = (from: number, to: number) => from + ((((to - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI

/** Spec 3, §4.4: the camera glides from cell to cell (180 ms, instant with reduced motion) and carries the torchlight. */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const pose = useDungeon((s) => s.run?.pose ?? null)
  const effect = useDungeon((s) => s.effect)
  const reducedMotion = useApp((s) => s.reducedMotion)
  const light = useRef<PointLight>(null)
  const from = useRef<{ x: number; z: number; yaw: number } | null>(null)
  const to = useRef<{ x: number; z: number; yaw: number } | null>(null)
  const since = useRef(0)
  const bumpSince = useRef<number | null>(null)
  const clock = useThree((s) => s.clock)

  useEffect(() => {
    if (!pose) return
    const target = { x: pose.x, z: pose.y, yaw: YAW[pose.dir] }
    const current = to.current
    if (!current || reducedMotion) {
      from.current = target
    } else {
      // From where the camera is now, even mid-step.
      const t = ease(Math.min(1, ((clock.elapsedTime - since.current) * 1000) / STEP_MS))
      const start = from.current ?? current
      from.current = { x: start.x + (current.x - start.x) * t, z: start.z + (current.z - start.z) * t, yaw: start.yaw + (current.yaw - start.yaw) * t }
    }
    to.current = { ...target, yaw: shortest(from.current.yaw, target.yaw) }
    since.current = clock.elapsedTime
  }, [pose, reducedMotion, clock])

  useEffect(() => {
    if (effect?.kind === 'bump' && !reducedMotion) bumpSince.current = clock.elapsedTime
  }, [effect, reducedMotion, clock])

  useFrame((state) => {
    const start = from.current
    const end = to.current
    if (!start || !end || !pose) return
    const t = ease(Math.min(1, ((state.clock.elapsedTime - since.current) * 1000) / STEP_MS))
    let x = start.x + (end.x - start.x) * t
    let z = start.z + (end.z - start.z) * t
    const yaw = start.yaw + (end.yaw - start.yaw) * t
    if (bumpSince.current !== null) {
      const b = ((state.clock.elapsedTime - bumpSince.current) * 1000) / BUMP_MS
      if (b >= 1) bumpSince.current = null
      else {
        const push = Math.sin(b * Math.PI) * 0.08
        x += DELTA[pose.dir].x * push
        z += DELTA[pose.dir].y * push
      }
    }
    camera.position.set(x, EYE, z)
    camera.rotation.set(0, yaw, 0)
    if (light.current) {
      light.current.position.set(x, EYE + 0.1, z)
      light.current.intensity = reducedMotion ? 2.2 : 2.2 * (1 + Math.sin(state.clock.elapsedTime * 13) * 0.04 + Math.sin(state.clock.elapsedTime * 7.3) * 0.04)
    }
  })

  return <pointLight ref={light} color="#FFB066" intensity={2.2} distance={6} decay={1.4} />
}

