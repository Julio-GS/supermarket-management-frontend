/**
 * Bootstrap state as consumed by the UI layer.
 */
export interface BootstrapStatusState {
  status: "pending" | "in_progress" | "complete" | "failed"
  ready: boolean
  syncCursor: string | null
  error?: string
  /**
   * True when the device is offline and bootstrap data is not yet available.
   * In this case the app renders children anyway with empty local data.
   */
  isOfflineMode?: boolean
}
