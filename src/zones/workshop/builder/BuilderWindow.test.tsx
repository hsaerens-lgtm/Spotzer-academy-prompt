import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { appStore } from '../../../core/store'
import { resetAppStore } from '../../../test/resetAppStore'
import type { BuildingInput } from '../../../workshop/building/plan'
import type { BuilderScene3DProps } from './BuilderScene3D'
import BuilderScene3D from './BuilderScene3D'
import { BuilderWindow } from './BuilderWindow'

vi.mock('./BuilderScene3D', () => ({ default: vi.fn(() => null) }))
const scene = vi.mocked(BuilderScene3D)
/** The props of the scene's latest render. Its runKey is the window's serial for the run, not the parent's key. */
const lastProps = () => scene.mock.lastCall![0] as BuilderScene3DProps

const labels = { role: 'Role', task: 'Task', context: 'Context', format: 'Format', example: 'Example', constraint: 'Constraint' }
const leaning: BuildingInput = { qualities: { role: 3, task: 3, context: 1, format: 2, example: 0, constraint: 0 }, cracked: [], tier: 'passable' }
const holding: BuildingInput = { qualities: { role: 3, task: 3, context: 3, format: 3, example: 0, constraint: 0 }, cracked: [], tier: 'excellent' }

async function show(props: Partial<Parameters<typeof BuilderWindow>[0]> = {}) {
  const onDone = vi.fn()
  const view = await act(async () => render(<BuilderWindow input={leaning} runKey={1} labels={labels} onDone={onDone} {...props} />))
  return { ...view, onDone }
}

beforeEach(() => {
  resetAppStore()
  scene.mockReset()
  scene.mockImplementation(() => <div data-testid="scene-3d" />)
})

test('before any test the builder waits', async () => {
  await show({ input: null, runKey: 0 })
  expect(screen.getByText('Your building will appear here after Build & test.')).toBeInTheDocument()
})

test('the waiting text can be the program\'s own', async () => {
  await show({ input: null, runKey: 0, emptyText: 'Your building will appear here after Check my prompt.' })
  expect(screen.getByText('Your building will appear here after Check my prompt.')).toBeInTheDocument()
  expect(screen.queryByText('Your building will appear here after Build & test.')).not.toBeInTheDocument()
})

test('without WebGL the plan view is shown and the run is done at once', async () => {
  resetAppStore({ webgl: 'unavailable' })
  const { onDone } = await show()
  const plan = screen.getByRole('list', { name: 'Plan view of your building, from the roof down' })
  expect(within(plan).getAllByRole('button').map((b) => b.textContent)).toEqual(['FormatWOOD', 'ContextCARDBOARD', 'TaskSTONE', 'RoleSTONE'])
  expect(onDone).toHaveBeenCalledWith(1)
  expect(screen.getByText('The building leans.')).toBeInTheDocument()
  expect(screen.getByRole('meter', { name: 'Stability' })).toHaveAttribute('aria-valuenow', '75')
  expect(scene).not.toHaveBeenCalled()
})

test('the plan view marks a cracked floor and a hole', async () => {
  resetAppStore({ webgl: 'unavailable' })
  await show({ input: { qualities: { role: 0, task: 3, context: 3, format: 3, example: 0, constraint: 0 }, cracked: ['format'], tier: 'vague' } })
  const plan = screen.getByRole('list', { name: /Plan view/ })
  expect(within(plan).getAllByRole('button').map((b) => b.textContent)).toEqual(['FormatSTONE \u00B7 CRACKED', 'ContextSTONE', 'TaskSTONE', 'RoleHOLE'])
  expect(screen.getByText('The building collapses.')).toBeInTheDocument()
})

test('reading mode also uses the plan view, and plan rows lead to their block', async () => {
  resetAppStore({ readingMode: true })
  const onBlockClick = vi.fn()
  await show({ onBlockClick })
  await userEvent.click(screen.getByRole('button', { name: /Context/ }))
  expect(onBlockClick).toHaveBeenCalledWith('context')
})

test('with WebGL the 3D scene runs, Skip shows until it is done', async () => {
  const { onDone } = await show()
  expect(screen.getByTestId('scene-3d')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.getByText('Role: stone, Task: stone, Context: cardboard, Format: wood. The building leans.', { selector: '.sr-only' })).toBeInTheDocument()
  const props = scene.mock.lastCall![0] as BuilderScene3DProps
  act(() => props.onDone(props.runKey))
  expect(onDone).toHaveBeenCalledWith(1)
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  expect(screen.getByText('The building leans.')).toBeInTheDocument()
})

test('Skip and Reset view are passed to the scene', async () => {
  await show()
  const before = scene.mock.lastCall![0] as BuilderScene3DProps
  await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
  await userEvent.click(screen.getByRole('button', { name: 'Reset view' }))
  const after = scene.mock.lastCall![0] as BuilderScene3DProps
  expect(after.skipToken).toBe(before.skipToken + 1)
  expect(after.resetToken).toBe(before.resetToken + 1)
})

// Review focus 2: a second Build & test during the animation.
test('only the latest run reports', async () => {
  const { onDone, rerender } = await show()
  const stale = scene.mock.lastCall![0] as BuilderScene3DProps
  await act(async () => rerender(<BuilderWindow input={holding} runKey={2} labels={labels} onDone={onDone} />))
  const latest = scene.mock.lastCall![0] as BuilderScene3DProps
  act(() => stale.onDone(stale.runKey))
  expect(onDone).not.toHaveBeenCalled()
  expect(screen.queryByText('The building leans.')).not.toBeInTheDocument()
  act(() => latest.onDone(latest.runKey))
  expect(onDone).toHaveBeenCalledWith(2)
  expect(screen.getByText('The building holds.')).toBeInTheDocument()
})

// One canvas per builder window: a new Build & test replays the building in the same scene (and WebGL context).
test('a second Build & test reuses the 3D scene instead of remounting it', async () => {
  let mounts = 0
  scene.mockImplementation(() => {
    useEffect(() => {
      mounts += 1
    }, [])
    return <div data-testid="scene-3d" />
  })
  const { onDone, rerender } = await show()
  const first = lastProps()
  await act(async () => rerender(<BuilderWindow input={holding} runKey={2} labels={labels} onDone={onDone} />))
  expect(mounts).toBe(1)
  expect(lastProps().input).toBe(holding)
  expect(lastProps().runKey).not.toBe(first.runKey)
})

test("a stale run's completion never reports the new run, and a run reports once", async () => {
  const { onDone, rerender } = await show()
  const first = lastProps()
  await act(async () => rerender(<BuilderWindow input={holding} runKey={2} labels={labels} onDone={onDone} />))
  // The scene stays mounted: the building of run 1, still settling, reports its own key through the current callbacks.
  const props = lastProps()
  act(() => props.onDone(first.runKey))
  expect(onDone).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.queryByRole('meter', { name: 'Stability' })).not.toBeInTheDocument()
  act(() => props.onDone(props.runKey))
  act(() => props.onDone(props.runKey))
  expect(onDone.mock.calls).toEqual([[2]])
})

// Review round 1 (a, d): the scene's run key is the window's own serial, so a parent key reused for a new building
// (two fix missions both start at attempt 0) still makes a new run.
test('the same run key with a new building is a new run, and the old building cannot finish it', async () => {
  const { onDone, rerender } = await show()
  const first = lastProps()
  act(() => first.onDone(first.runKey))
  expect(onDone.mock.calls).toEqual([[1]])
  await act(async () => rerender(<BuilderWindow input={holding} runKey={1} labels={labels} onDone={onDone} />))
  const second = lastProps()
  expect(second.runKey).not.toBe(first.runKey)
  expect(second.instant).toBe(false)
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.queryByRole('meter', { name: 'Stability' })).not.toBeInTheDocument()
  act(() => second.onDone(first.runKey))
  expect(onDone.mock.calls).toEqual([[1]])
  act(() => second.onDone(second.runKey))
  expect(onDone.mock.calls).toEqual([[1], [1]])
  expect(screen.getByText('The building holds.')).toBeInTheDocument()
})

test('a failure belongs to its building: the same run key with a new building tries the 3D builder again', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  scene.mockImplementation(() => {
    if (broken) throw new Error('The physics engine did not load')
    return <div data-testid="scene-3d" />
  })
  const { onDone, rerender } = await show()
  expect(screen.getByText("The 3D builder isn't available here, so here's the plan view.")).toBeInTheDocument()
  broken = false
  await act(async () => rerender(<BuilderWindow input={holding} runKey={1} labels={labels} onDone={onDone} />))
  expect(screen.getByTestId('scene-3d')).toBeInTheDocument()
  expect(screen.queryByText("The 3D builder isn't available here, so here's the plan view.")).not.toBeInTheDocument()
  expect(screen.queryByRole('meter', { name: 'Stability' })).not.toBeInTheDocument()
  act(() => lastProps().onDone(lastProps().runKey))
  expect(onDone.mock.calls).toEqual([[1], [1]])
  error.mockRestore()
})

test('with reduced motion the 3D builder is told to jump to the end and the run is done at once', async () => {
  resetAppStore({ reducedMotion: true })
  const { onDone } = await show()
  const props = lastProps()
  expect(props.instant).toBe(true)
  expect(onDone).toHaveBeenCalledWith(1)
  expect(screen.getByText('The building leans.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  act(() => props.onDone(props.runKey))
  expect(onDone).toHaveBeenCalledTimes(1)
})

// Review round 1 (b): no replay of a run already seen to its end, and a Skip is never lost (even during loading).
test('a skipped run, or a finished one shown again, jumps straight to its final state', async () => {
  const { onDone } = await show()
  expect(lastProps().instant).toBe(false)
  await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
  expect(lastProps().instant).toBe(true)
  act(() => lastProps().onDone(lastProps().runKey))
  act(() => appStore.getState().setReadingMode(true))
  expect(screen.getByRole('list', { name: /Plan view/ })).toBeInTheDocument()
  await act(async () => appStore.getState().setReadingMode(false))
  expect(screen.getByTestId('scene-3d')).toBeInTheDocument()
  expect(lastProps().instant).toBe(true)
  expect(onDone.mock.calls).toEqual([[1]])
})

// A program opened again (the corrector) shows a building it had already seen to its end: no replay.
test('a building already seen jumps straight to its final state and is done at once', async () => {
  const { onDone } = await show({ seen: true })
  expect(lastProps().instant).toBe(true)
  expect(onDone.mock.calls).toEqual([[1]])
  expect(screen.getByText('The building leans.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  act(() => lastProps().onDone(lastProps().runKey))
  expect(onDone).toHaveBeenCalledTimes(1)
})

// Review round 1 (c): focus never falls back to the page when Skip goes away.
test('when the run ends while Skip has the focus, Reset view takes it', async () => {
  await show()
  await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
  expect(screen.getByRole('button', { name: 'Skip' })).toHaveFocus()
  act(() => lastProps().onDone(lastProps().runKey))
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reset view' })).toHaveFocus()
})

test('a run ending while the focus is elsewhere does not steal it', async () => {
  await show()
  expect(document.body).toHaveFocus()
  act(() => lastProps().onDone(lastProps().runKey))
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  expect(document.body).toHaveFocus()
})

test('the block being read is passed up', async () => {
  const onReading = vi.fn()
  await show({ onReading })
  const props = scene.mock.lastCall![0] as BuilderScene3DProps
  act(() => props.onReading?.('task'))
  expect(onReading).toHaveBeenCalledWith('task')
})

test('a 3D failure falls back to the plan view', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  scene.mockImplementation(() => {
    throw new Error('WebGL not available')
  })
  const { onDone } = await show()
  expect(screen.getByText("The 3D builder isn't available here, so here's the plan view.")).toBeInTheDocument()
  expect(screen.getByRole('list', { name: /Plan view/ })).toBeInTheDocument()
  expect(onDone).toHaveBeenCalledWith(1)
  error.mockRestore()
})

// F12: the plan view standing in for a failed 3D builder is announced with the result, so the parent is told first.
test('a 3D failure tells the parent that the plan view stands in for the run, before the run is done', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  scene.mockImplementation(() => {
    throw new Error('WebGL not available')
  })
  const order: string[] = []
  const onUnavailable = vi.fn((key: number) => order.push(`unavailable ${key}`))
  const onDone = vi.fn((key: number) => order.push(`done ${key}`))
  await act(async () => render(<BuilderWindow input={leaning} runKey={1} labels={labels} onDone={onDone} onUnavailable={onUnavailable} />))
  expect(order).toEqual(['unavailable 1', 'done 1'])
  error.mockRestore()
})

test('the plan view chosen from the start (no WebGL) is no fallback', async () => {
  resetAppStore({ webgl: 'unavailable' })
  const onUnavailable = vi.fn()
  const { onDone } = await show({ onUnavailable })
  expect(onDone).toHaveBeenCalledWith(1)
  expect(onUnavailable).not.toHaveBeenCalled()
})

// Review round 1: the real scene throws once its canvas reports a lost context (a captured setter stands in for it).
test('a WebGL context lost while the scene is on screen hands the run to the plan view', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  let loseContext = () => {}
  scene.mockImplementation(() => {
    const [lost, setLost] = useState(false)
    loseContext = () => setLost(true)
    if (lost) throw new Error('The builder lost its WebGL context')
    return <div data-testid="scene-3d" />
  })
  const { onDone } = await show()
  expect(screen.getByTestId('scene-3d')).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()
  act(() => loseContext())
  expect(screen.getByText("The 3D builder isn't available here, so here's the plan view.")).toBeInTheDocument()
  expect(screen.getByRole('list', { name: /Plan view/ })).toBeInTheDocument()
  expect(screen.getByText('The building leans.')).toBeInTheDocument()
  expect(onDone.mock.calls).toEqual([[1]])
  error.mockRestore()
})

test('after a 3D failure the next Build & test tries the 3D builder again', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  scene.mockImplementation(() => {
    if (broken) throw new Error('The physics engine did not load')
    return <div data-testid="scene-3d" />
  })
  const { onDone, rerender } = await show()
  expect(screen.getByRole('list', { name: /Plan view/ })).toBeInTheDocument()
  broken = false
  await act(async () => rerender(<BuilderWindow input={holding} runKey={2} labels={labels} onDone={onDone} />))
  expect(screen.getByTestId('scene-3d')).toBeInTheDocument()
  expect(screen.queryByText("The 3D builder isn't available here, so here's the plan view.")).not.toBeInTheDocument()
  expect(onDone.mock.calls).toEqual([[1]])
  error.mockRestore()
})
