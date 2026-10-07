import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { installTestApi } from './testApi'

beforeEach(() => resetAppStore())
afterEach(() => {
  delete window.__academy
})

test('exposes the state and the object actions', () => {
  installTestApi(appStore)
  expect(window.__academy?.state().zone).toBe('office')
  window.__academy?.clickObject('laptop')
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
})

test('setPhase changes the phase at once', () => {
  resetAppStore({ phase: 'day', phaseTransition: { from: 'night', to: 'day', startedAt: 0 } })
  installTestApi(appStore)
  window.__academy?.setPhase('night')
  expect(appStore.getState()).toMatchObject({ phase: 'night', phaseTransition: null })
  expect(window.__academy?.state().phase).toBe('night')
})

test('rail moves the camera target', () => {
  installTestApi(appStore)
  window.__academy?.rail(0.5)
  expect(appStore.getState().railTarget).toBe(0.5)
  window.__academy?.rail(3)
  expect(appStore.getState().railTarget).toBe(1)
})
