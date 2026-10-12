import type { Rapier } from './simulation'

let loading: Promise<Rapier> | null = null

/** Loads and initialises the physics engine once, on first use (it is a separate chunk). A failure can be retried. */
export function loadRapier(): Promise<Rapier> {
  if (!loading) {
    const pending = import('@dimforge/rapier3d-compat').then(async (module) => {
      const R = module.default
      await R.init()
      return R
    })
    pending.catch(() => {
      if (loading === pending) loading = null
    })
    loading = pending
  }
  return loading
}
