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
