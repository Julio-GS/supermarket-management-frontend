import type { BootstrapStatusState } from "../domain/bootstrap-state"

/**
 * Abstraction for bootstrap readiness checks.
 *
 * The desktop adapter delegates to the Electron IPC bridge; the web adapter
 * always returns `complete` so the gate never blocks browser-only usage.
 */
export interface BootstrapPort {
  /** Whether we are running inside the Electron desktop shell. */
  isDesktop: boolean

  /** Fetch the current bootstrap/readiness state. */
  getStatus(): Promise<BootstrapStatusState>

  /** Start a new bootstrap from scratch. Only meaningful in desktop mode. */
  startBootstrap(params: { token: string; apiBaseUrl: string }): Promise<BootstrapStatusState>

  /** Resume or restart a pending/in-progress/failed bootstrap. */
  resumeBootstrap(params: { token: string; apiBaseUrl: string }): Promise<BootstrapStatusState>

  /**
   * Manually trigger a connectivity re-check via the desktop bridge
   * and return the refreshed bootstrap state. Desktop-only.
   */
  retryConnectivity(params: { apiBaseUrl: string }): Promise<BootstrapStatusState>
}
