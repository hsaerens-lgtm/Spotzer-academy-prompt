// Ported from Horn.os (owner's project): js/scene/city.js (buildSky)
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { useLightingApplier } from '../lighting/live'
import { PRESETS, SUN_TARGET } from '../lighting/presets'
import { OUTDOOR } from './cityPlan'
import { disposeTree } from './resources'
import { SKY_FRAGMENT, SKY_VERTEX } from './shaders'

function buildSky() {
  const day = PRESETS.day
  const uniforms = {
    uTop: { value: day.skyTop.clone() },
    uHorizon: { value: day.skyHorizon.clone() },
    uSunDir: { value: new Vector3().subVectors(day.sunPosition, SUN_TARGET).normalize() },
    uSunColor: { value: day.sunDisc.clone() },
    uSunSize: { value: day.sunSize },
    uStars: { value: day.stars },
    uTime: { value: 0 },
  }
  const material = new ShaderMaterial({ uniforms, side: BackSide, depthWrite: false, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT })
  const mesh = new Mesh(new SphereGeometry(OUTDOOR.domeRadius, 48, 24), material)
  mesh.name = 'sky'
  mesh.renderOrder = -100 // drawn first, behind everything
  return { mesh, uniforms }
}

/** The sky dome: horizon-to-zenith gradient, a sun disc that follows the directional light, stars at night. */
export function Sky() {
  const sky = useMemo(buildSky, [])
  useEffect(() => () => disposeTree(sky.mesh), [sky])
  useLightingApplier((p) => {
    const u = sky.uniforms
    u.uTop.value.copy(p.skyTop)
    u.uHorizon.value.copy(p.skyHorizon)
    u.uSunDir.value.subVectors(p.sunPosition, SUN_TARGET).normalize()
    u.uSunColor.value.copy(p.sunDisc)
    u.uSunSize.value = p.sunSize
    u.uStars.value = p.stars
  })
  useFrame(({ clock }) => {
    sky.uniforms.uTime.value = clock.elapsedTime
  })
  return <primitive object={sky.mesh} />
}
