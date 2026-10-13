import { extend } from '@react-three/fiber'
import { Suspense, use, useLayoutEffect } from 'react'
import { Group } from 'three'
import { isClockDeprecation, mountR3F, type TestRoot } from '../test/r3fRoot'
import { TransitionMount } from './TransitionMount'

/*
 * The office mounts in a transition, after a first commit without it, inside a Suspense boundary that is already
 * revealed (Task 16b): if it suspends, React keeps showing nothing instead of committing the fallback, and commits the
 * office as soon as its assets are in. A committed fallback would make React hold the reveal back until 300 ms after it.
 */

extend({ Group })

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!isClockDeprecation(args)) throw new Error(`unexpected warning: ${String(args[0])}`)
  })
})
const roots: TestRoot[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await root.unmount()
  vi.restoreAllMocks()
})

function setup() {
  let resolve!: () => void
  const loaded = new Promise<void>((res) => (resolve = res))
  // Called when React commits the fallback (it may render one it never commits).
  const fallback = vi.fn()
  function Fallback() {
    useLayoutEffect(() => fallback())
    return null
  }
  function Office() {
    use(loaded)
    return <group name="office" />
  }
  return { resolve, fallback, Fallback, Office }
}

test('a suspending child mounts without the boundary ever committing its fallback', async () => {
  const { resolve, fallback, Fallback, Office } = setup()
  const root = await mountR3F(
    <Suspense fallback={<Fallback />}>
      <TransitionMount>
        <Office />
      </TransitionMount>
    </Suspense>,
  )
  roots.push(root)
  expect(root.state.scene.getObjectByName('office')).toBeUndefined()
  resolve()
  await vi.waitFor(async () => {
    await root.frame()
    expect(root.state.scene.getObjectByName('office')).toBeDefined()
  })
  expect(fallback).not.toHaveBeenCalled()
})

// The control: mounted directly, the same child commits the boundary's fallback first.
test('mounted directly, the same child commits the fallback while it suspends', async () => {
  const { resolve, fallback, Fallback, Office } = setup()
  const root = await mountR3F(
    <Suspense fallback={<Fallback />}>
      <Office />
    </Suspense>,
  )
  roots.push(root)
  resolve()
  await vi.waitFor(async () => {
    await root.frame()
    expect(root.state.scene.getObjectByName('office')).toBeDefined()
  })
  expect(fallback).toHaveBeenCalled()
})
