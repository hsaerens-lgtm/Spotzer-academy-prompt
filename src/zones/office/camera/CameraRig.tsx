import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { isEditable } from '../../../core/dom'
import { appStore } from '../../../core/store'
import { layout, layoutVersion } from '../layout'
import {
  FLIGHT_SECONDS,
  KEY_STEP,
  RAIL_SMOOTH_TIME,
  easeInOutCubic,
  lerpPose,
  makeRail,
  wheelDelta,
  type PoseVectors,
} from './railMath'

const PARALLAX = { x: 0.35, y: 0.18 }

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  const rail = useRef({ version: layoutVersion.current, sample: makeRail(layout.rail) })
  const railT = useRef({ value: appStore.getState().railTarget })
  const parallax = useRef({ x: 0, y: 0 })
  const pointer = useRef({ x: 0, y: 0 })
  const flight = useRef<{ from: PoseVectors; elapsed: number; done: boolean } | null>(null)
  const wasInTransition = useRef(false)
  const pose = useMemo<PoseVectors>(() => ({ position: new Vector3(), target: new Vector3() }), [])
  const lookTarget = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const s = appStore.getState()
      if (s.zone !== 'office' || s.transition) return
      event.preventDefault()
      s.nudgeRail(wheelDelta(event))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [canvas])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = appStore.getState()
      if (s.zone !== 'office' || s.transition || isEditable(event.target)) return
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        s.nudgeRail(KEY_STEP)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        s.nudgeRail(-KEY_STEP)
      } else if (event.key === 'Home') s.setRailTarget(0)
      else if (event.key === 'End') s.setRailTarget(1)
    }
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  useFrame((_, delta) => {
    const s = appStore.getState()
    if (rail.current.version !== layoutVersion.current) {
      rail.current = { version: layoutVersion.current, sample: makeRail(layout.rail) }
    }
    const transition = s.transition

    if (transition?.stage === 'flight' && transition.via) {
      if (!flight.current) {
        flight.current = { from: { position: camera.position.clone(), target: lookTarget.clone() }, elapsed: 0, done: false }
      }
      const current = flight.current
      current.elapsed += delta
      const k = easeInOutCubic(Math.min(1, current.elapsed / FLIGHT_SECONDS))
      lerpPose(current.from, layout.flights[transition.via], k, pose)
      camera.position.copy(pose.position)
      lookTarget.copy(pose.target)
      camera.lookAt(lookTarget)
      if (k >= 1 && !current.done) {
        current.done = true
        s.transitionStep()
      }
      wasInTransition.current = true
      return
    }
    if (transition) {
      wasInTransition.current = true
      return
    }
    if (wasInTransition.current) {
      // Back from another zone: snap to the rail while the fader still covers the screen.
      wasInTransition.current = false
      flight.current = null
      railT.current.value = s.railTarget
    }

    if (s.reducedMotion) railT.current.value = s.railTarget
    else easing.damp(railT.current, 'value', s.railTarget, RAIL_SMOOTH_TIME, delta)
    rail.current.sample(railT.current.value, pose)

    easing.damp(parallax.current, 'x', s.reducedMotion ? 0 : pointer.current.x, 0.4, delta)
    easing.damp(parallax.current, 'y', s.reducedMotion ? 0 : pointer.current.y, 0.4, delta)
    camera.position.copy(pose.position)
    lookTarget.copy(pose.target)
    lookTarget.x += parallax.current.x * PARALLAX.x
    lookTarget.y -= parallax.current.y * PARALLAX.y
    camera.lookAt(lookTarget)
  })

  return null
}
