import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { resetAppStore } from '../../../test/resetAppStore'
import type { BuildingInput } from '../../../workshop/building/plan'
import type { BuilderScene3DProps } from './BuilderScene3D'
import BuilderScene3D from './BuilderScene3D'
import { BuilderWindow } from './BuilderWindow'

vi.mock('./BuilderScene3D', () => ({ default: vi.fn(() => null) }))
const scene = vi.mocked(BuilderScene3D)

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
  act(() => props.onDone(1))
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
  act(() => stale.onDone(1))
  expect(onDone).not.toHaveBeenCalled()
  expect(screen.queryByText('The building leans.')).not.toBeInTheDocument()
  act(() => latest.onDone(2))
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
  await act(async () => rerender(<BuilderWindow input={holding} runKey={2} labels={labels} onDone={onDone} />))
  expect(mounts).toBe(1)
  expect(scene.mock.lastCall![0]).toMatchObject({ input: holding, runKey: 2 })
})

test("a stale run's completion never reports the new run, and a run reports once", async () => {
  const { onDone, rerender } = await show()
  await act(async () => rerender(<BuilderWindow input={holding} runKey={2} labels={labels} onDone={onDone} />))
  // The scene stays mounted: the building of run 1, still settling, reports through the current callbacks.
  const props = scene.mock.lastCall![0] as BuilderScene3DProps
  act(() => props.onDone(1))
  expect(onDone).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.queryByRole('meter', { name: 'Stability' })).not.toBeInTheDocument()
  act(() => props.onDone(2))
  act(() => props.onDone(2))
  expect(onDone.mock.calls).toEqual([[2]])
})

test('with reduced motion the 3D builder is told to jump to the end and the run is done at once', async () => {
  resetAppStore({ reducedMotion: true })
  const { onDone } = await show()
  const props = scene.mock.lastCall![0] as BuilderScene3DProps
  expect(props.instant).toBe(true)
  expect(onDone).toHaveBeenCalledWith(1)
  expect(screen.getByText('The building leans.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
  act(() => props.onDone(1))
  expect(onDone).toHaveBeenCalledTimes(1)
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
