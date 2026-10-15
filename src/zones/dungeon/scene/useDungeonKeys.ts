import { useCallback, useEffect, useRef } from 'react'
import type { Command } from '../../../dungeon/movement'

/** By physical key (event.code): W A S D Q E sit where they should on AZERTY too (Z Q S D A E). */
export const KEYMAP: Record<string, Command> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowDown: 'back',
  KeyS: 'back',
  ArrowLeft: 'turnLeft',
  KeyA: 'turnLeft',
  ArrowRight: 'turnRight',
  KeyD: 'turnRight',
  KeyQ: 'strafeLeft',
  KeyE: 'strafeRight',
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Movement keys while exploring in 3D; never from a text field, never with a modifier (spec 3, §3.2). */
export function useDungeonKeys(onCommand: (command: Command) => void, enabled: boolean): void {
  const handler = useRef(onCommand)
  handler.current = onCommand
  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      const command = KEYMAP[event.code]
      if (!command || typing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      handler.current(command)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

/**
 * A step lasts `duration` ms (0 with reduced motion). While one runs, a single command waits (the latest) and runs as
 * the step ends; the others are dropped, so holding a key never queues a long walk.
 */
export function useMoveQueue(run: (command: Command) => void, duration: number): (command: Command) => void {
  const busyUntil = useRef(0)
  const waiting = useRef<Command | null>(null)
  const timer = useRef<number | null>(null)
  const runner = useRef(run)
  runner.current = run

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const send = useCallback(
    (command: Command) => {
      const now = performance.now()
      if (now < busyUntil.current) {
        waiting.current = command
        if (timer.current === null) {
          timer.current = window.setTimeout(() => {
            timer.current = null
            const next = waiting.current
            waiting.current = null
            busyUntil.current = 0
            if (next) send(next)
          }, busyUntil.current - now)
        }
        return
      }
      busyUntil.current = now + duration
      runner.current(command)
    },
    [duration],
  )
  return send
}
