import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { CanvasTexture, SRGBColorSpace, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { brand } from '../../../core/brand'
import { sound } from '../../../core/sound'
import { STEP_HZ } from '../../../workshop/building/materials'
import { planBuilding, type BuildingInput, type BuildingPlan, type PlannedBody } from '../../../workshop/building/plan'
import { loadRapier } from '../../../workshop/building/rapier'
import { createSimulation, type Rapier, type Simulation } from '../../../workshop/building/simulation'
import { phaseAt, readingBlock, scanProgress, type Phase } from '../../../workshop/building/timeline'
import type { CoreBlock } from '../../../workshop/model'

export interface BuilderScene3DProps {
  input: BuildingInput
  runKey: number
  skipToken: number
  resetToken: number
  /** Reduced motion: jump straight to the final state. */
  instant: boolean
  aiLabel: string
  onPhase: (phase: Phase) => void
  onDone: (runKey: number) => void
  onBlockClick?: (block: CoreBlock) => void
  onReading?: (block: CoreBlock | null) => void
}

const CAMERA: [number, number, number] = [5.4, 3.4, 6.6]
const TARGET: [number, number, number] = [0, 0.9, 0]

function colorOf(body: PlannedBody): string {
  if (body.material === 'ai') return brand.onDark
  if (body.block === 'format' && body.material === 'stone') return brand.lime
  return body.material === 'stone' ? brand.onDark : body.material === 'wood' ? brand.mint : brand.warn
}

function labelTexture(text: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = brand.ink
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = brand.lime
    ctx.font = 'bold 40px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 64, 34)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** One Build & test: the building to simulate and the key its completion reports. */
interface RunSpec {
  key: number
  plan: BuildingPlan
}

/** The run the frame loop is playing: its own simulation and what it has already reported. */
interface LiveRun {
  spec: RunSpec
  simulation: Simulation
  accumulator: number
  phase: Phase | null
  reading: CoreBlock | null
  reported: boolean
}

interface SceneProps extends Omit<BuilderScene3DProps, 'input' | 'runKey'> {
  R: Rapier
  run: RunSpec
  onSettled: (run: RunSpec) => void
}

function BuildingScene({ R, run, skipToken, resetToken, instant, aiLabel, onPhase, onDone, onBlockClick, onReading, onSettled }: SceneProps) {
  const { plan } = run
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const meshes = useRef(new Map<string, Mesh>())
  const scan = useRef<Group>(null)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const live = useRef<LiveRun | null>(null)
  const latestOnReading = useRef(onReading)
  latestOnReading.current = onReading
  const seenSkip = useRef(skipToken)
  const seenReset = useRef(resetToken)
  const aiTexture = useMemo(() => labelTexture(aiLabel), [aiLabel])
  useEffect(() => () => aiTexture.dispose(), [aiTexture])

  // Each Build & test gets its own simulation, in the same canvas (one WebGL context per builder window). It is
  // created and the previous one freed in the commit that swaps the building, so no frame steps a freed world.
  useLayoutEffect(() => {
    const current: LiveRun = { spec: run, simulation: createSimulation(run.plan, R), accumulator: 0, phase: null, reading: null, reported: false }
    live.current = current
    return () => {
      live.current = null
      current.simulation.dispose()
      // A run replaced (or unmounted) while the AI was reading it: the studio stops highlighting the block.
      if (current.reading !== null) latestOnReading.current?.(null)
    }
  }, [run, R])
  useEffect(() => {
    if (skipToken === seenSkip.current) return
    seenSkip.current = skipToken
    live.current?.simulation.runToEnd()
  }, [skipToken])
  useEffect(() => {
    if (resetToken === seenReset.current) return
    seenReset.current = resetToken
    const orbit = controls.current
    if (!orbit) return
    camera.position.set(...CAMERA)
    orbit.target.set(...TARGET)
    orbit.update()
    invalidate()
  }, [resetToken, camera, invalidate])

  useFrame((_, delta) => {
    const current = live.current
    if (!current) return
    const { simulation } = current
    const { plan: playing, key } = current.spec
    if (instant) simulation.runToEnd()
    else if (!simulation.finished) {
      current.accumulator += Math.min(delta, 0.1)
      const step = 1 / STEP_HZ
      while (current.accumulator >= step && !simulation.finished) {
        current.accumulator -= step
        for (const event of simulation.advance()) {
          if (event.kind === 'impact') sound.thud(playing.tier === 'vague' ? 1 : 0.7)
          else sound.thud(event.id === 'ai' ? 0.5 : 0.25)
        }
      }
    }
    const reading = readingBlock(playing, simulation.step)
    if (reading !== current.reading) {
      current.reading = reading
      onReading?.(reading)
    }
    for (const sim of simulation.bodies) {
      const mesh = meshes.current.get(sim.plan.id)
      if (!mesh) continue
      mesh.visible = sim.enabled
      ;(mesh.material as MeshStandardMaterial).emissiveIntensity = reading !== null && sim.plan.block === reading ? 0.45 : 0
      if (!sim.enabled) continue
      const p = sim.body.translation()
      const q = sim.body.rotation()
      mesh.position.set(p.x, p.y, p.z)
      mesh.quaternion.set(q.x, q.y, q.z, q.w)
    }
    const progress = scanProgress(playing, simulation.step)
    if (scan.current) {
      scan.current.visible = progress !== null
      if (progress !== null) scan.current.position.y = progress * playing.top
    }
    const phase = phaseAt(playing, simulation.step)
    if (phase !== current.phase) {
      current.phase = phase
      onPhase(phase)
    }
    // The key of the run that finished, never the latest prop: a replaced run must not report for its successor.
    if (simulation.finished && !current.reported) {
      current.reported = true
      onDone(key)
      onSettled(current.spec)
    }
  })

  return (
    <>
      <hemisphereLight args={[brand.onDark, brand.surface1, 0.7]} />
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={6}
        shadow-camera-bottom={-2}
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={brand.surface2} />
      </mesh>
      <gridHelper args={[12, 24, brand.blueGrey, brand.surface3]} position-y={0.002} />
      {plan.bodies.map((body) => (
        <mesh
          key={body.id}
          ref={(mesh) => {
            if (mesh) meshes.current.set(body.id, mesh)
            else meshes.current.delete(body.id)
          }}
          position={body.position}
          visible={false}
          castShadow
          receiveShadow
          onClick={(event) => {
            event.stopPropagation()
            if (body.block !== 'ai') onBlockClick?.(body.block)
          }}
        >
          <boxGeometry args={body.size} />
          <meshStandardMaterial color={colorOf(body)} emissive={brand.lime} emissiveIntensity={0} roughness={0.75} map={body.material === 'ai' ? aiTexture : null} />
          {(body.material === 'ai' || body.id.endsWith('-left') || body.id.endsWith('-right')) && (
            <Edges color={body.material === 'ai' ? brand.lime : brand.ink} />
          )}
        </mesh>
      ))}
      {plan.decorations.map((decoration, index) => (
        <mesh key={`${decoration.kind}-${index}`} position={decoration.position} rotation-z={decoration.rotationZ} castShadow>
          <boxGeometry args={decoration.size} />
          <meshStandardMaterial color={decoration.kind === 'pillar' ? brand.blueGrey : brand.mint} />
        </mesh>
      ))}
      <group ref={scan} visible={false}>
        <mesh>
          <boxGeometry args={[3.6, 0.025, 1.9]} />
          <meshBasicMaterial color={brand.lime} transparent opacity={0.85} />
        </mesh>
      </group>
      <OrbitControls ref={controls} makeDefault enablePan={false} target={TARGET} minDistance={6} maxDistance={14} minPolarAngle={0.6} maxPolarAngle={1.45} />
    </>
  )
}

/**
 * The physics building in its own small canvas (the office canvas stays paused behind the workshop). The canvas is
 * created once: a new Build & test (new run key or new building) replays in it with a fresh simulation.
 */
export default function BuilderScene3D({ input, runKey, ...rest }: BuilderScene3DProps) {
  const R = use(loadRapier())
  const plan = useMemo(() => planBuilding(input), [input])
  const run = useMemo<RunSpec>(() => ({ key: runKey, plan }), [runKey, plan])
  // The frame loop runs while the current run plays, then renders on demand (orbiting, clicks).
  const [settled, setSettled] = useState<RunSpec | null>(null)
  return (
    <Canvas
      className="ws-builder__canvas"
      shadows="percentage"
      dpr={[1, 1.5]}
      frameloop={settled === run ? 'demand' : 'always'}
      camera={{ position: CAMERA, fov: 40, near: 0.1, far: 60 }}
      aria-hidden="true"
    >
      <BuildingScene {...rest} R={R} run={run} onSettled={setSettled} />
    </Canvas>
  )
}
