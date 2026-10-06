import type RapierModule from '@dimforge/rapier3d-compat'
import type { ImpulseJoint, RevoluteImpulseJoint, RigidBody } from '@dimforge/rapier3d-compat'
import type { Outcome } from '../model'
import { HINGE, OUTCOME_LIMITS, SOLVER_ITERATIONS, STEP_HZ, VAGUE_SHOVE_STEPS } from './materials'
import type { BuildingPlan, PlannedBody } from './plan'

export type Rapier = typeof RapierModule

export type SimEvent = { kind: 'appear'; id: string } | { kind: 'impact' }

export interface SimBody {
  plan: PlannedBody
  body: RigidBody
  joint: ImpulseJoint | null
  enabled: boolean
}

export interface Simulation {
  readonly plan: BuildingPlan
  readonly bodies: readonly SimBody[]
  readonly step: number
  readonly finished: boolean
  /** One fixed step (1/60 s). Returns what happened during it. */
  advance(): SimEvent[]
  runToEnd(): void
  dispose(): void
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }
const Z_AXIS = { x: 0, y: 0, z: 1 }
const GROUND_HALF = 30
/** Seen from a joint, the ground (top face at y = 0) is a very wide floor of no height. */
const GROUND_FLOOR: Pick<PlannedBody, 'position' | 'size'> = { position: [0, 0, 0], size: [2 * GROUND_HALF, 0, 2 * GROUND_HALF] }

/**
 * Where a joint meets the two floors. A weld holds the upper floor at its centre; a hinge turns about the
 * upper floor's edge on its pivot side, kept on the lower floor's top face: a hinge beside a narrower floor
 * would turn about thin air and topple the floors instead of leaning them.
 */
function anchors(upper: PlannedBody, lower: Pick<PlannedBody, 'position' | 'size'>, atEdge: boolean) {
  const [lowerX] = lower.position
  const [upperX] = upper.position
  const edge = upperX + (upper.link.pivotSide * upper.size[0]) / 2
  const reach = lower.size[0] / 2
  const pivot = atEdge ? Math.min(lowerX + reach, Math.max(lowerX - reach, edge)) : upperX
  return {
    lower: { x: pivot - lowerX, y: lower.size[1] / 2, z: 0 },
    upper: { x: pivot - upperX, y: -upper.size[1] / 2, z: 0 },
  }
}

/**
 * How far each hinge turns at the impact, relative to the floor below it. A hinge turns by its lean, the way
 * that lifts the side away from its pivot, so hinged floors zig-zag; the turn is cut short so that no hinged
 * floor ends up tilted more than HINGE.maxAngle in the world (it then never dips into the floor below).
 * Welded floors keep the angle of the floor below; unlinked floors are taken as upright.
 */
function hingeTurns(bodies: readonly PlannedBody[]): Map<string, number> {
  const turns = new Map<string, number>()
  const worldAngle = new Map<string, number>()
  for (const { id, link } of bodies) {
    const lower = link.to === null ? 0 : (worldAngle.get(link.to) ?? 0)
    if (link.kind === 'hinge') {
      const leaned = lower - link.pivotSide * link.lean
      const turn = Math.min(HINGE.maxAngle, Math.max(-HINGE.maxAngle, leaned)) - lower
      turns.set(id, turn)
      worldAngle.set(id, lower + turn)
    } else {
      worldAngle.set(id, link.kind === 'weld' ? lower : 0)
    }
  }
  return turns
}

export function createSimulation(plan: BuildingPlan, R: Rapier): Simulation {
  const ids = new Set(plan.bodies.map((b) => b.id))
  for (const { id, link } of plan.bodies) {
    if (link.to !== null && !ids.has(link.to)) throw new Error(`Body "${id}" is linked to "${link.to}", which is not in the plan`)
  }
  const turns = hingeTurns(plan.bodies)

  const world = new R.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = 1 / STEP_HZ
  world.numSolverIterations = SOLVER_ITERATIONS
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed())
  world.createCollider(R.ColliderDesc.cuboid(GROUND_HALF, 0.1, GROUND_HALF).setTranslation(0, -0.1, 0).setFriction(1), ground)

  const byId = new Map<string, SimBody>()
  const bodies: SimBody[] = plan.bodies.map((planned) => {
    const [x, y, z] = planned.position
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setEnabled(false).setCanSleep(false))
    const [w, h, d] = planned.size
    world.createCollider(
      R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setDensity(planned.density).setFriction(planned.friction).setRestitution(planned.restitution),
      body,
    )
    const sim: SimBody = { plan: planned, body, joint: null, enabled: false }
    byId.set(planned.id, sim)
    return sim
  })

  let step = 0
  let disposed = false

  const enable = (sim: SimBody) => {
    sim.body.setEnabled(true)
    sim.enabled = true
    const { link } = sim.plan
    if (link.kind === 'none') return
    // `to: null` is the ground under the foundation; any other id was checked above.
    const below = link.to === null ? null : byId.get(link.to)!
    const at = anchors(sim.plan, below?.plan ?? GROUND_FLOOR, link.kind === 'hinge')
    const data = link.kind === 'weld' ? R.JointData.fixed(at.lower, IDENTITY, at.upper, IDENTITY) : R.JointData.revolute(at.lower, at.upper, Z_AXIS)
    const joint = world.createImpulseJoint(data, below?.body ?? ground, sim.body, true)
    // A hinge stands straight until the impact.
    if (link.kind === 'hinge') (joint as RevoluteImpulseJoint).setLimits(0, 0)
    sim.joint = joint
  }

  /**
   * From the impact on, `since` steps later: each hinge's limits turn it a little further, up to its full
   * turn after HINGE.rampSteps (limits, unlike a motor, hold whatever load rests above), and pushed bodies
   * are held at their push speed sideways for VAGUE_SHOVE_STEPS, whatever rests on them.
   */
  const afterImpact = (since: number) => {
    const ramp = Math.min(1, (since + 1) / HINGE.rampSteps)
    for (const sim of bodies) {
      const { id, link, push } = sim.plan
      if (since < HINGE.rampSteps && sim.joint && link.kind === 'hinge') {
        const angle = (turns.get(id) ?? 0) * ramp
        ;(sim.joint as RevoluteImpulseJoint).setLimits(angle, angle)
      }
      if (since < VAGUE_SHOVE_STEPS && push !== 0 && sim.enabled) {
        const velocity = sim.body.linvel()
        sim.body.setLinvel({ x: push, y: velocity.y, z: velocity.z }, true)
      }
    }
  }

  const advance = (): SimEvent[] => {
    if (disposed || step >= plan.steps.end) return []
    const events: SimEvent[] = []
    for (const sim of bodies) {
      if (!sim.enabled && sim.plan.appearStep === step) {
        enable(sim)
        events.push({ kind: 'appear', id: sim.plan.id })
      }
    }
    if (step === plan.steps.impact) events.push({ kind: 'impact' })
    if (step >= plan.steps.impact) afterImpact(step - plan.steps.impact)
    world.step()
    step += 1
    return events
  }

  return {
    plan,
    bodies,
    get step() {
      return step
    },
    get finished() {
      return step >= plan.steps.end
    },
    advance,
    runToEnd: () => {
      while (!disposed && step < plan.steps.end) advance()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      world.free()
    },
  }
}

/** Angle between a body's up axis and the world's up axis. */
export function tiltOf(q: { x: number; y: number; z: number; w: number }): number {
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z)
  return Math.acos(Math.min(1, Math.max(-1, upY)))
}

export interface OutcomeMeasure {
  outcome: Outcome
  maxTilt: number
  maxDrop: number
}

export function measureOutcome(sim: Simulation): OutcomeMeasure {
  let maxTilt = 0
  let maxDrop = 0
  for (const s of sim.bodies) {
    if (s.plan.block === 'ai' || !s.enabled) continue
    maxTilt = Math.max(maxTilt, tiltOf(s.body.rotation()))
    maxDrop = Math.max(maxDrop, s.plan.position[1] - s.body.translation().y)
  }
  const hole = sim.plan.slots.some((slot) => slot.material === 'hole')
  const outcome: Outcome =
    hole || maxDrop > OUTCOME_LIMITS.collapseDrop || maxTilt > OUTCOME_LIMITS.collapseTilt
      ? 'collapses'
      : maxTilt < OUTCOME_LIMITS.holdTilt
        ? 'holds'
        : 'leans'
  return { outcome, maxTilt, maxDrop }
}
