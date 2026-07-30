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

  async function getOfflineState() {
    try {
      if (!window.marketDesktop?.offline) {
        return { connectivity: "unknown" as const }
      }
      return await window.marketDesktop.offline.getState()
    } catch {
      return { connectivity: "unknown" as const }
    }
  }

  async function getIsOfflineMode(): Promise<boolean> {
    const state = await getOfflineState()
    return state?.connectivity === "offline"
  }

  function toState(
    result: BootstrapResult,
    isOfflineMode: boolean,
    connectivity?: BootstrapStatusState["connectivity"],
  ): BootstrapStatusState {
    return {
      status: result.status,
      ready: result.ready,
      syncCursor: result.syncCursor,
      error: result.error,
      isOfflineMode,
      connectivity,
    }
  }

  return {
    isDesktop: true,

    async getStatus(): Promise<BootstrapStatusState> {
      const api = getBootstrapApi()
      const [result, offlineState] = await Promise.all([api.status(), getOfflineState()])
      const isOfflineMode = offlineState?.connectivity === "offline"
      return toState(result, isOfflineMode, offlineState?.connectivity)
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

    async retryConnectivity(params: {
      apiBaseUrl: string
    }): Promise<BootstrapStatusState> {
      if (window.marketDesktop?.offline?.checkConnectivity) {
        await window.marketDesktop.offline.checkConnectivity(params)
      }
      const api = getBootstrapApi()
      const [result, offlineState] = await Promise.all([api.status(), getOfflineState()])
      const isOfflineMode = offlineState?.connectivity === "offline"
      return toState(result, isOfflineMode, offlineState?.connectivity)
    },
  }
}
