import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"

/**
 * Bootstrap adapter for non-desktop (browser) environments.
 *
 * Always returns `complete` so the bootstrap gate never blocks usage
 * when the app is running in a regular browser or in dev mode.
 */
export function createWebBootstrapAdapter(): BootstrapPort {
  const complete: BootstrapStatusState = {
    status: "complete",
    ready: true,
    syncCursor: null,
  }

  return {
    isDesktop: false,

    async getStatus(): Promise<BootstrapStatusState> {
      return complete
    },

    async startBootstrap(): Promise<BootstrapStatusState> {
      return complete
    },

    async resumeBootstrap(): Promise<BootstrapStatusState> {
      return complete
    },
  }
}
