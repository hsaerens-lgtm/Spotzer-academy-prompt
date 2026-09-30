import { act, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { ObjectLabel } from './ObjectLabel'

beforeEach(() => resetAppStore())

function movePointer(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
  })
}

test('shows nothing while no object is hovered', () => {
  render(<ObjectLabel />)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

test('names the hovered object next to the pointer', () => {
  render(<ObjectLabel />)
  movePointer(100, 200)
  act(() => appStore.getState().setHovered('laptop'))
  const label = screen.getByRole('tooltip')
  expect(label).toHaveTextContent('Prompt Workshop')
  expect(label).toHaveClass('object-label')
  expect(label).toHaveStyle({ left: '116px', top: '218px' })
})

test('follows the pointer and uses the label of the hovered object', () => {
  render(<ObjectLabel />)
  act(() => appStore.getState().setHovered('tv'))
  movePointer(300, 40)
  expect(screen.getByRole('tooltip')).toHaveTextContent('The Dungeon')
  expect(screen.getByRole('tooltip')).toHaveStyle({ left: '316px', top: '58px' })
})

test('disappears when the hover ends', () => {
  render(<ObjectLabel />)
  act(() => appStore.getState().setHovered('laptop'))
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  act(() => appStore.getState().setHovered(null))
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
})

test('does not re-render on pointer moves while nothing is hovered, then uses the last position', () => {
  const onRender = vi.fn()
  render(
    <Profiler id="object-label" onRender={onRender}>
      <ObjectLabel />
    </Profiler>,
  )
  const commits = onRender.mock.calls.length
  movePointer(50, 60)
  movePointer(70, 80)
  expect(onRender).toHaveBeenCalledTimes(commits)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

  act(() => appStore.getState().setHovered('laptop'))
  expect(screen.getByRole('tooltip')).toHaveStyle({ left: '86px', top: '98px' })
})
