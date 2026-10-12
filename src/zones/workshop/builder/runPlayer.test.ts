// @vitest-environment node
import RAPIER from '@dimforge/rapier3d-compat'
import { planBuilding, type BuildingInput } from '../../../workshop/building/plan'
import { createRunPlayer, type RunCallbacks } from './runPlayer'

beforeAll(async () => {
  await RAPIER.init()
})

const leaning: BuildingInput = { qualities: { role: 3, task: 3, context: 1, format: 2, example: 0, constraint: 0 }, cracked: [], tier: 'passable' }

function callbacks() {
  const calls = { onEvent: vi.fn(), onPhase: vi.fn(), onReading: vi.fn(), onDone: vi.fn() } satisfies RunCallbacks
  return calls
}

function player(key = 7) {
  return createRunPlayer({ key, plan: planBuilding(leaning) }, RAPIER)
}

/** Frames of 40 ms (2.4 steps each) until the run is done, at most 20 s of them. */
function playToEnd(run: ReturnType<typeof player>, calls: RunCallbacks) {
  for (let frame = 0; frame < 500 && !run.simulation.finished; frame += 1) run.frame(0.04, false, calls)
  run.frame(0.04, false, calls)
}

test('steps at the fixed rate whatever the frame length, catching up at most 0.1 s per frame', () => {
  const run = player()
  const calls = callbacks()
  run.frame(1 / 60, false, calls)
  expect(run.simulation.step).toBe(1)
  run.frame(0.04, false, calls)
  expect(run.simulation.step).toBe(3)
  // 1 s after a hidden tab: 0.1 s is played, plus the 0.4 step carried over from the last frame.
  run.frame(1, false, calls)
  expect(run.simulation.step).toBe(9)
  run.dispose(calls.onReading)
})

test('reports the floor being read, then null, the phases in order, and done once with its own key', () => {
  const run = player(7)
  const calls = callbacks()
  playToEnd(run, calls)
  run.frame(0.04, false, calls)
  expect(calls.onReading.mock.calls).toEqual([['role'], ['task'], ['context'], ['format'], [null]])
  expect(calls.onPhase.mock.calls).toEqual([['placing'], ['reading'], ['loading'], ['done']])
  expect(calls.onDone.mock.calls).toEqual([[7]])
  expect(calls.onEvent).toHaveBeenCalledWith({ kind: 'impact' })
  run.dispose(calls.onReading)
  expect(calls.onReading).toHaveBeenCalledTimes(5)
})

test('instant: the final state at the first frame, no reading and no sound, done at once', () => {
  const run = player(3)
  const calls = callbacks()
  run.frame(0, true, calls)
  expect(run.simulation.finished).toBe(true)
  expect(calls.onReading).not.toHaveBeenCalled()
  expect(calls.onEvent).not.toHaveBeenCalled()
  expect(calls.onPhase.mock.calls).toEqual([['done']])
  expect(calls.onDone.mock.calls).toEqual([[3]])
  run.dispose(calls.onReading)
})

test('a run disposed while the AI reads it reports null, then never steps or reports again', () => {
  const run = player()
  const calls = callbacks()
  while (calls.onReading.mock.calls.length === 0) run.frame(0.04, false, calls)
  const step = run.simulation.step
  run.dispose(calls.onReading)
  expect(calls.onReading.mock.lastCall).toEqual([null])
  const reports = calls.onReading.mock.calls.length + calls.onPhase.mock.calls.length
  // A disposed simulation never finishes: the frame must not loop on it, touch the freed world or report.
  run.frame(0.04, false, calls)
  run.frame(0, true, calls)
  run.dispose(calls.onReading)
  expect(run.simulation.step).toBe(step)
  expect(calls.onReading.mock.calls.length + calls.onPhase.mock.calls.length).toBe(reports)
  expect(calls.onDone).not.toHaveBeenCalled()
})
