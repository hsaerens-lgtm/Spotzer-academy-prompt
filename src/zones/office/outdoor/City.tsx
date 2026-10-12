// Ported from Horn.os (owner's project): js/scene/city.js (buildBuildings)
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import { useQualitySettings } from '../../../app/quality'
import { appStore } from '../../../core/store'
import { tints } from '../../../three/tints'
import { useLightingApplier } from '../lighting/live'
import { PRESETS, SUN_TARGET } from '../lighting/presets'
import { CITY_STYLES, OUTDOOR, cityLayout, type RoofItem } from './cityPlan'
import { disposeTree } from './resources'
import { BEACON_FRAGMENT, BEACON_VERTEX, FACADE_FRAGMENT, FACADE_VERTEX } from './shaders'

/** Facade colours of each style (tints.ts), indexed by CITY_STYLES. */
const TONES: Record<number, readonly string[]> = {
  [CITY_STYLES.brick]: tints.city.brick,
  [CITY_STYLES.glass]: tints.city.glass,
  [CITY_STYLES.concrete]: tints.city.concrete,
  [CITY_STYLES.plaster]: tints.city.plaster,
}

function roofMesh(geometry: BufferGeometry, material: MeshStandardMaterial, items: RoofItem[]) {
  const mesh = new InstancedMesh(geometry, material, items.length)
  const matrix = new Matrix4()
  const identity = new Quaternion()
  items.forEach((item, i) => mesh.setMatrixAt(i, matrix.compose(new Vector3(item.x, item.y, item.z), identity, new Vector3(item.sx, item.sy, item.sz))))
  mesh.frustumCulled = false
  return mesh
}

function buildCity() {
  const { buildings, units, tanks, beacons } = cityLayout()
  const day = PRESETS.day

  // Buildings: one instanced unit box, the facades drawn in the shader.
  const geometry = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const uniforms = {
    uSunDir: { value: new Vector3().subVectors(day.sunPosition, SUN_TARGET).normalize() },
    uSunColor: { value: day.sunColor.clone().multiplyScalar(day.sunIntensity * 0.22) },
    uAmbient: { value: day.cityAmbient.clone() },
    uNight: { value: day.night },
    uTime: { value: 0 },
    uSky: { value: day.skyHorizon.clone() },
    uSkyTop: { value: day.skyTop.clone() },
    uFogColor: { value: day.skyHorizon.clone() },
    uFogNear: { value: OUTDOOR.fogNear },
    uFogFar: { value: OUTDOOR.fogFar },
  }
  const material = new ShaderMaterial({
    uniforms,
    defines: { GROUND_Y: OUTDOOR.groundY.toFixed(1) },
    vertexShader: FACADE_VERTEX,
    fragmentShader: FACADE_FRAGMENT,
  })
  const mesh = new InstancedMesh(geometry, material, buildings.length)
  mesh.name = 'buildings'
  const tones = new Float32Array(buildings.length * 3)
  const styles = new Float32Array(buildings.length)
  const matrix = new Matrix4()
  const identity = new Quaternion()
  const colour = new Color()
  buildings.forEach((b, i) => {
    mesh.setMatrixAt(i, matrix.compose(new Vector3(b.x, OUTDOOR.groundY, b.z), identity, new Vector3(b.w, b.h, b.d)))
    const list = TONES[b.style]
    colour.set(list[Math.floor(b.tone * list.length)])
    tones.set([colour.r, colour.g, colour.b], i * 3)
    styles[i] = b.style
  })
  geometry.setAttribute('aTone', new InstancedBufferAttribute(tones, 3))
  geometry.setAttribute('aStyle', new InstancedBufferAttribute(styles, 1))
  mesh.frustumCulled = false

  // Rooftop plant: air-handling units and water tanks on the lower roofs.
  const unitMesh = roofMesh(
    new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new MeshStandardMaterial({ color: tints.city.roofUnit, roughness: 0.7, metalness: 0.3 }),
    units,
  )
  const tankMesh = roofMesh(new CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0), new MeshStandardMaterial({ color: tints.city.waterTank, roughness: 0.9 }), tanks)

  // Aircraft warning lights on the towers.
  const beaconGeometry = new BufferGeometry()
  beaconGeometry.setAttribute('position', new BufferAttribute(new Float32Array(beacons.flatMap((b) => [b.x, b.y, b.z])), 3))
  beaconGeometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(beacons.map((b) => b.phase)), 1))
  const beaconUniforms = { uTime: { value: 0 }, uNight: { value: day.night } }
  const beaconPoints = new Points(
    beaconGeometry,
    new ShaderMaterial({
      uniforms: beaconUniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: BEACON_VERTEX,
      fragmentShader: BEACON_FRAGMENT,
    }),
  )
  beaconPoints.name = 'beacons'
  beaconPoints.frustumCulled = false

  const group = new Group()
  group.name = 'city'
  group.add(mesh, unitMesh, tankMesh, beaconPoints)
  return { group, uniforms, beaconUniforms }
}

/**
 * The city: instanced buildings whose windows light up at night, each on its own clock (frozen on the low tier and
 * under reduced motion), and the blinking beacons of the towers (still under reduced motion).
 */
export function City() {
  const settings = useQualitySettings()
  const city = useMemo(buildCity, [])
  useEffect(() => () => disposeTree(city.group), [city])
  useLightingApplier((p) => {
    const u = city.uniforms
    u.uSunDir.value.subVectors(p.sunPosition, SUN_TARGET).normalize()
    u.uSunColor.value.copy(p.sunColor).multiplyScalar(p.sunIntensity * 0.22)
    u.uAmbient.value.copy(p.cityAmbient)
    u.uNight.value = p.night
    u.uSky.value.copy(p.skyHorizon)
    u.uSkyTop.value.copy(p.skyTop)
    u.uFogColor.value.copy(p.skyHorizon)
    city.beaconUniforms.uNight.value = p.night
  })
  useFrame(({ clock }) => {
    // Window clocks and beacons stand still when the user asks for reduced motion; the low tier freezes the windows.
    if (appStore.getState().reducedMotion) return
    if (settings.animateCityWindows) city.uniforms.uTime.value = clock.elapsedTime
    city.beaconUniforms.uTime.value = clock.elapsedTime
  })
  return <primitive object={city.group} />
}
