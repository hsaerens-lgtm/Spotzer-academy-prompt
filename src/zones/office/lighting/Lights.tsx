import { Fragment, use, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Object3D, type DirectionalLight, type HemisphereLight, type PointLight, type RectAreaLight, type SpotLight } from 'three'
import type { QualitySettings } from '../../../app/quality'
import { CEILING_LINES, layout } from '../layout'
import { useLightingApplier } from './live'
import { SUN_TARGET } from './presets'
import { RIG, crtGlowCandela, rigLights } from './rig'

let areaLightTables: Promise<void> | null = null

/**
 * Area lights need their lookup tables in the WebGL renderer before the first one is drawn. The tables (about
 * 0.1 MB of JS) load on the first Lights mount, once, outside the initial chunk: reading mode never builds them.
 * A failed load is forgotten, so the next mount tries again.
 */
function areaLightTablesReady(): Promise<void> {
  areaLightTables ??= import('three/addons/lights/RectAreaLightUniformsLib.js').then(
    ({ RectAreaLightUniformsLib }) => RectAreaLightUniformsLib.init(),
    (error: unknown) => {
      areaLightTables = null
      throw error
    },
  )
  return areaLightTables
}

/**
 * The named lights of the office (rig.ts). Only the sun casts shadows: 2048 px on the high tier, 1024 on medium,
 * none on low. Colours, intensities and the sun's position follow the time of day through one applier.
 */
export function Lights({ settings }: { settings: QualitySettings }) {
  // Suspends the scene (its Suspense keeps the loading screen) until the area light tables are built.
  use(areaLightTablesReady())
  const sun = useRef<DirectionalLight>(null)
  const sky = useRef<HemisphereLight>(null)
  const facade = useRef<RectAreaLight>(null)
  const lamp = useRef<SpotLight>(null)
  const glow = useRef<PointLight>(null)
  const crt = useRef<SpotLight>(null)
  const pendant = useRef<PointLight>(null)
  const ceiling = useRef<(RectAreaLight | null)[]>([])
  const sunTarget = useMemo(() => new Object3D(), [])
  const lampTarget = useMemo(() => new Object3D(), [])
  const crtTarget = useMemo(() => new Object3D(), [])
  const shadowSize = settings.shadowMapSize

  useLayoutEffect(() => {
    // R3F does not refresh a shadow camera's projection: set the frustum here, once, and update it.
    const shadow = sun.current!.shadow
    Object.assign(shadow.camera, RIG.sun.camera)
    shadow.camera.updateProjectionMatrix()
    shadow.bias = RIG.sun.shadowBias
    shadow.normalBias = RIG.sun.normalBias
    // Lights shine along their local -z: turn the facade light toward the room.
    facade.current!.lookAt(...RIG.window.lookAt)
  }, [])

  useEffect(() => {
    const shadow = sun.current?.shadow
    if (!shadow) return
    // A new size only takes effect with a new shadow map; without shadows (low tier) the old one is only memory.
    shadow.map?.dispose()
    shadow.map = null
    if (shadowSize > 0) shadow.mapSize.set(shadowSize, shadowSize)
  }, [shadowSize])

  useLightingApplier((p) => {
    if (sun.current) {
      sun.current.color.copy(p.sunColor)
      sun.current.intensity = p.sunIntensity
      sun.current.position.copy(p.sunPosition)
    }
    if (sky.current) {
      sky.current.color.copy(p.hemiSky)
      sky.current.groundColor.copy(p.hemiGround)
      sky.current.intensity = p.hemiIntensity
    }
    if (facade.current) {
      facade.current.color.copy(p.windowColor)
      facade.current.intensity = p.windowIntensity
    }
    if (lamp.current) lamp.current.intensity = p.lampIntensity
    if (glow.current) glow.current.intensity = p.screenGlow
    if (crt.current) crt.current.intensity = crtGlowCandela(p)
    for (const light of ceiling.current) if (light) light.intensity = RIG.ceilingLines.nits * p.ceiling
    if (pendant.current) pendant.current.intensity = RIG.pendant.candela * p.ceiling
  })

  const elements: Record<string, ReactNode> = {
    sun: <directionalLight ref={sun} name="sun" target={sunTarget} castShadow={shadowSize > 0} />,
    'sky-fill': <hemisphereLight ref={sky} name="sky-fill" />,
    'window-light': <rectAreaLight ref={facade} name="window-light" position={RIG.window.position} width={RIG.window.width} height={RIG.window.height} />,
    'lamp-light': (
      <spotLight
        ref={lamp}
        name="lamp-light"
        position={layout.lights.lamp.position}
        target={lampTarget}
        color={RIG.lamp.colour}
        angle={RIG.lamp.angle}
        penumbra={RIG.lamp.penumbra}
        distance={RIG.lamp.distance}
        decay={RIG.lamp.decay}
        intensity={0}
      />
    ),
    'screen-glow': (
      <pointLight
        ref={glow}
        name="screen-glow"
        position={layout.lights.screenGlow.position}
        color={RIG.screenGlow.colour}
        distance={RIG.screenGlow.distance}
        decay={RIG.screenGlow.decay}
        intensity={0}
      />
    ),
    'crt-glow': (
      <spotLight
        ref={crt}
        name="crt-glow"
        position={layout.lights.crt.position}
        target={crtTarget}
        color={RIG.screenGlow.colour}
        angle={RIG.crtGlow.angle}
        penumbra={RIG.crtGlow.penumbra}
        distance={RIG.crtGlow.distance}
        decay={RIG.crtGlow.decay}
        intensity={0}
      />
    ),
    'pendant-light': (
      <pointLight
        ref={pendant}
        name="pendant-light"
        position={layout.lights.pendant.position}
        color={RIG.pendant.colour}
        distance={RIG.pendant.distance}
        decay={RIG.pendant.decay}
        intensity={0}
      />
    ),
  }
  CEILING_LINES.forEach((line, i) => {
    elements[`ceiling-light-${i}`] = (
      <rectAreaLight
        ref={(light) => {
          ceiling.current[i] = light
        }}
        name={`ceiling-light-${i}`}
        position={[line.x, RIG.ceilingLines.y, (line.z0 + line.z1) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={RIG.ceilingLines.width}
        height={RIG.ceilingLines.length}
        color={RIG.pendant.colour}
        intensity={0}
      />
    )
  })

  return (
    <>
      <primitive object={sunTarget} position={SUN_TARGET} />
      <primitive object={lampTarget} position={layout.lights.lamp.target} />
      <primitive object={crtTarget} position={layout.lights.crt.target} />
      {rigLights(settings).map(({ name }) => (
        <Fragment key={name}>{elements[name]}</Fragment>
      ))}
    </>
  )
}
