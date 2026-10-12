import { isSubmitShortcut } from './keys'

test('Ctrl+Enter, or Cmd+Enter on a Mac, submits; Enter alone or another key does not', () => {
  expect(isSubmitShortcut(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))).toBe(true)
  expect(isSubmitShortcut(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }))).toBe(true)
  expect(isSubmitShortcut(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false)
  expect(isSubmitShortcut(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))).toBe(false)
})
