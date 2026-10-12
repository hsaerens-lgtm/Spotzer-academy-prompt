/** Ctrl+Enter (Cmd+Enter on a Mac): the workshop's "build / check this prompt" shortcut. Takes DOM and React events. */
export function isSubmitShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey)
}
