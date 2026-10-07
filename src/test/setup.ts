import '@testing-library/jest-dom/vitest'
import { initI18n } from '../core/i18n'

initI18n('en')

// Files marked `// @vitest-environment node` (simulation, server) have no `window`.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
}

afterEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear()
})
