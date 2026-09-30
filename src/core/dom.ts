export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function isButtonLike(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName) || target.getAttribute('role') === 'button'
}
