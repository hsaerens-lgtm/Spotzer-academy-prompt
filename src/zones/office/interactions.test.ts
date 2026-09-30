import { appStore } from '../../core/store'
import { resetAppStore } from '../../test/resetAppStore'
import { objectActions } from './interactions'

beforeEach(() => resetAppStore())

test('the laptop flies to the workshop', () => {
  objectActions.laptop()
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
})

test('the TV flies to the dungeon', () => {
  objectActions.tv()
  expect(appStore.getState().transition).toEqual({ to: 'dungeon', via: 'tv', stage: 'flight' })
})

test('clicking Ada makes her wave', () => {
  objectActions.ada()
  expect(appStore.getState().adaPokes).toBe(1)
})
