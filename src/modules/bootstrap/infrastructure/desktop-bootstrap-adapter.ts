import type { BootstrapPort } from "../application/bootstrap-port"
import type { BootstrapStatusState } from "../domain/bootstrap-state"
import type { BootstrapResult } from "@/shared/infrastructure/market-desktop-config"

/**
 * Bootstrap adapter that delegates to the Electron main process via
 * `window.marketDesktop.bootstrap.*`.
 *
 * Also reads `offline.getState()` to determine connectivity so the gate
 * can render children when offline even if bootstrap has not occurred yet.
 */
export function createDesktopBootstrapAdapter(): BootstrapPort {
  function getBootstrapApi() {
    if (typeof window === "undefined" || !window.marketDesktop?.bootstrap) {
      throw new Error("Desktop bootstrap bridge is not available")
    }
    return window.marketDesktop.bootstrap
  }

  async function getIsOfflineMode(): Promise<boolean> {
    try {
      if (!window.marketDesktop?.offline) return false
      const state = await window.marketDesktop.offline.getState()
      return state.connectivity === "offline"
    } catch {
      return false
    }
  }

  function toState(
    result: BootstrapResult,
    isOfflineMode: boolean,
  ): BootstrapStatusState {
    return {
      status: result.status,
      ready: result.ready,
      syncCursor: result.syncCursor,
      error: result.error,
      isOfflineMode,
    }
  }

  return {
    isDesktop: true,

    async getStatus(): Promise<BootstrapStatusState> {
      const api = getBootstrapApi()
      const [result, isOfflineMode] = await Promise.all([api.status(), getIsOfflineMode()])
      return toState(result, isOfflineMode)
    },

    async startBootstrap(params: {
      token: string
      apiBaseUrl: string
    }): Promise<BootstrapStatusState> {
      const api = getBootstrapApi()
      const result = await api.start(params)
      return toState(result, false)
    },

    async resumeBootstrap(params: {
      token: string
      apiBaseUrl: string
    }): Promise<BootstrapStatusState> {
      const api = getBootstrapApi()
      const result = await api.resume(params)
      return toState(result, false)
    },
  }
}
