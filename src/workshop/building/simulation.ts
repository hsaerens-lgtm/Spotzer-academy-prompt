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

export function createSimulation(plan: BuildingPlan, R: Rapier): Simulation {
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

  const enable = (sim: SimBody) => {
    sim.body.setEnabled(true)
    sim.enabled = true
    const { link } = sim.plan
    if (link.kind === 'none') return
    // `to: null` is the ground under the foundation.
    const below = link.to === null ? null : byId.get(link.to)
    if (below === undefined) return
    const at = anchors(sim.plan, below?.plan ?? GROUND_FLOOR, link.kind === 'hinge')
    const data = link.kind === 'weld' ? R.JointData.fixed(at.lower, IDENTITY, at.upper, IDENTITY) : R.JointData.revolute(at.lower, at.upper, Z_AXIS)
    const joint = world.createImpulseJoint(data, below?.body ?? ground, sim.body, true)
    if (link.kind === 'hinge') {
      const hinge = joint as RevoluteImpulseJoint
      const limit = Math.abs(link.lean) + HINGE.margin
      hinge.setLimits(-limit, limit)
      hinge.configureMotorPosition(0, HINGE.stiffness, HINGE.damping)
    }
    sim.joint = joint
  }

  /**
   * From the impact on, `since` steps later: hinged floors lean progressively (a stiff motor whose target
   * ramps up, so the load above cannot hold them straight and nothing is flung), and pushed floors are
   * shoved sideways at their push speed for a few steps, whatever rests on them.
   */
  const afterImpact = (since: number) => {
    const ramp = Math.min(1, (since + 1) / HINGE.rampSteps)
    for (const sim of bodies) {
      const { link, push } = sim.plan
      if (since < HINGE.rampSteps && sim.joint && link.kind === 'hinge') {
        ;(sim.joint as RevoluteImpulseJoint).configureMotorPosition(-link.pivotSide * link.lean * ramp, HINGE.stiffness, HINGE.damping)
      }
      if (since < VAGUE_SHOVE_STEPS && push !== 0 && sim.enabled) {
        const velocity = sim.body.linvel()
        sim.body.setLinvel({ x: push, y: velocity.y, z: velocity.z }, true)
      }
    }
  }

  const advance = (): SimEvent[] => {
    if (step >= plan.steps.end) return []
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
      while (step < plan.steps.end) advance()
    },
    dispose: () => world.free(),
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
