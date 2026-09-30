import { appStore, type AppState } from '../core/store'

const initial = appStore.getState()

/** Restores the shared store between component tests. */
export function resetAppStore(overrides: Partial<AppState> = {}) {
  appStore.setState({ ...initial, ...overrides }, true)
}
