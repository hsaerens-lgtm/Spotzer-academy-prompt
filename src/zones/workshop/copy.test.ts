import { act, renderHook } from '@testing-library/react'
import { copyText, useCopyWithFallback } from './copy'

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

afterEach(() => {
  delete (navigator as { clipboard?: Clipboard }).clipboard
})

test('copyText is true when the text reaches the clipboard, false when it is refused or missing', async () => {
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'))
  stubClipboard(writeText)
  expect(await copyText('Role: A writer')).toBe(true)
  expect(writeText).toHaveBeenCalledWith('Role: A writer')
  expect(await copyText('Role: A writer')).toBe(false)
  delete (navigator as { clipboard?: Clipboard }).clipboard
  expect(await copyText('Role: A writer')).toBe(false)
})

test('useCopyWithFallback says Copied, or keeps the refused text to show selected, until reset', async () => {
  stubClipboard(vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied')))
  const { result } = renderHook(() => useCopyWithFallback())
  expect(result.current).toMatchObject({ copied: false, fallback: null })
  await act(() => result.current.copy('First'))
  expect(result.current).toMatchObject({ copied: true, fallback: null })
  await act(() => result.current.copy('Second'))
  expect(result.current).toMatchObject({ copied: false, fallback: 'Second' })
  act(() => result.current.reset())
  expect(result.current).toMatchObject({ copied: false, fallback: null })
})

test('a copy still on its way when the state is reset is dropped', async () => {
  let land: () => void = () => {}
  stubClipboard(() => new Promise<void>((resolve) => (land = resolve)))
  const { result } = renderHook(() => useCopyWithFallback())
  let pending: Promise<void> = Promise.resolve()
  act(() => {
    pending = result.current.copy('Old prompt')
  })
  act(() => result.current.reset())
  await act(async () => {
    land()
    await pending
  })
  expect(result.current).toMatchObject({ copied: false, fallback: null })
})

test('the fallback field is selected when it appears and again after each refused copy', async () => {
  stubClipboard(() => Promise.reject(new Error('denied')))
  const { result } = renderHook(() => useCopyWithFallback())
  const field = document.createElement('textarea')
  field.value = 'Role: A writer'
  const select = vi.spyOn(field, 'select')
  await act(() => result.current.copy('Role: A writer'))
  result.current.selectFallback(field)
  const first = result.current.selectFallback
  await act(() => result.current.copy('Role: A writer'))
  // A new ref callback per refused copy: React calls it again, so the text is selected again.
  expect(result.current.selectFallback).not.toBe(first)
  result.current.selectFallback(field)
  expect(select).toHaveBeenCalledTimes(2)
})
