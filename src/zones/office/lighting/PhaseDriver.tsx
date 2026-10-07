import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { appStore } from '../../../core/store'
import { createEnvironmentApplier, refreshOnStageReady } from './environment'
import { applyLighting, computeLive } from './live'

/**
 * Drives the time of day. Every frame: the live lighting (the phase, or the eased blend of a running transition) goes
 * to the tone-mapping exposure, the environment strength and every registered applier; a transition that has landed
 * is cleared. Written every frame on purpose: drei's <Environment> resets scene.environmentIntensity to 1 whenever it
 * renders again, and a component mounted later (the decor) gets the current values on its first frame.
 * The environment strength reaches each material at its own ratio through environment.ts (scene materials collected
 * again when the base or the decor becomes ready, or after requestMaterialRefresh()).
 */
export function PhaseDriver(): null {
  const live = useMemo(() => computeLive(appStore.getState().phase, null, 0), [])
  const applyEnvironment = useMemo(() => createEnvironmentApplier(), [])
  useEffect(() => refreshOnStageReady(appStore), [])
  useFrame(({ gl, scene }) => {
    const state = appStore.getState()
    computeLive(state.phase, state.phaseTransition, performance.now(), live)
    gl.toneMappingExposure = live.preset.exposure
    applyEnvironment(scene, live.preset.environment)
    applyLighting(live.preset, live.minutes)
    if (live.finished) state.finishPhaseTransition()
  })
  return null
}
