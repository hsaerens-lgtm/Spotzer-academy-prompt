import { STEP_HZ } from '../../../workshop/building/materials'
import type { BuildingPlan } from '../../../workshop/building/plan'
import { createSimulation, type Rapier, type SimEvent, type Simulation } from '../../../workshop/building/simulation'
import { phaseAt, readingBlock, scanProgress, type Phase } from '../../../workshop/building/timeline'
import type { CoreBlock } from '../../../workshop/model'

/** The longest frame the physics catches up on: after a hidden tab the building resumes instead of jumping ahead. */
const MAX_FRAME = 0.1

/** One Build & test: the building to simulate and the key its completion reports. */
export interface RunSpec {
  key: number
  plan: BuildingPlan
}

export interface RunCallbacks {
  onEvent: (event: SimEvent) => void
  onPhase: (phase: Phase) => void
  onReading: (block: CoreBlock | null) => void
  onDone: (runKey: number) => void
}

export interface RunPlayer {
  readonly run: RunSpec
  readonly simulation: Simulation
  /**
   * Plays a frame of `delta` seconds at the fixed step (all of the run when `instant`) and reports what changed:
   * each phase, the floor being read (then null), and the run's own key once it is done. Nothing after dispose.
   */
  frame(delta: number, instant: boolean, callbacks: RunCallbacks): { reading: CoreBlock | null; scan: number | null }
  /** Frees the physics world. A run cut short while the AI was reading it reports null. Idempotent. */
  dispose(onReading: (block: null) => void): void
}

/** Plays one run of the builder from the frame loop, independently of React and three. */
export function createRunPlayer(run: RunSpec, R: Rapier): RunPlayer {
  const simulation = createSimulation(run.plan, R)
  const { plan, key } = run
  let accumulator = 0
  let phase: Phase | null = null
  let reading: CoreBlock | null = null
  let reported = false
  let disposed = false

  return {
    run,
    simulation,
    frame(delta, instant, { onEvent, onPhase, onReading, onDone }) {
      // A disposed simulation never finishes (`finished` ignores disposal): never step, read or report it.
      if (disposed) return { reading: null, scan: null }
      if (instant) simulation.runToEnd()
      else if (!simulation.finished) {
        accumulator += Math.min(delta, MAX_FRAME)
        const step = 1 / STEP_HZ
        while (accumulator >= step && !simulation.finished) {
          accumulator -= step
          for (const event of simulation.advance()) onEvent(event)
        }
      }
      const now = readingBlock(plan, simulation.step)
      if (now !== reading) {
        reading = now
        onReading(now)
      }
      const current = phaseAt(plan, simulation.step)
      if (current !== phase) {
        phase = current
        onPhase(current)
      }
      if (simulation.finished && !reported) {
        reported = true
        onDone(key)
      }
      return { reading: now, scan: scanProgress(plan, simulation.step) }
    },
    dispose(onReading) {
      if (disposed) return
      disposed = true
      simulation.dispose()
      if (reading === null) return
      reading = null
      onReading(null)
    },
  }
}
