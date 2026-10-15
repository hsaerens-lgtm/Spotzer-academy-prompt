import { act, fireEvent, render } from '@testing-library/react'
import type { Command } from '../../../dungeon/movement'
import { KEYMAP, useDungeonKeys, useMoveQueue } from './useDungeonKeys'

function Probe({ onMove, enabled }: { onMove: (c: Command) => void; enabled: boolean }) {
  useDungeonKeys(onMove, enabled)
  return <input aria-label="field" />
}

test('physical keys map to commands, AZERTY included through event.code', () => {
  expect(KEYMAP.KeyW).toBe('forward')
  expect(KEYMAP.ArrowLeft).toBe('turnLeft')
  expect(KEYMAP.KeyQ).toBe('strafeLeft')
  expect(KEYMAP.KeyE).toBe('strafeRight')
})

test('moves only while enabled, never from a text field, never with a modifier', () => {
  const onMove = vi.fn()
  const { getByLabelText, rerender } = render(<Probe onMove={onMove} enabled />)
  fireEvent.keyDown(window, { code: 'ArrowUp' })
  expect(onMove).toHaveBeenCalledWith('forward')
  fireEvent.keyDown(getByLabelText('field'), { code: 'KeyW' })
  fireEvent.keyDown(window, { code: 'KeyW', ctrlKey: true })
  expect(onMove).toHaveBeenCalledTimes(1)
  rerender(<Probe onMove={onMove} enabled={false} />)
  fireEvent.keyDown(window, { code: 'ArrowUp' })
  expect(onMove).toHaveBeenCalledTimes(1)
})

function QueueProbe({ run, duration, expose }: { run: (c: Command) => void; duration: number; expose: (send: (c: Command) => void) => void }) {
  expose(useMoveQueue(run, duration))
  return null
}

test('during a step, one command waits and the rest are dropped; the waiting one runs when the step ends', () => {
  vi.useFakeTimers()
  try {
    const run = vi.fn()
    let send: (c: Command) => void = () => {}
    render(<QueueProbe run={run} duration={180} expose={(s) => (send = s)} />)
    act(() => send('forward'))
    act(() => send('turnLeft'))
    act(() => send('turnRight'))
    expect(run.mock.calls).toEqual([['forward']])
    act(() => void vi.advanceTimersByTime(180))
    expect(run.mock.calls).toEqual([['forward'], ['turnRight']])
  } finally {
    vi.useRealTimers()
  }
})
