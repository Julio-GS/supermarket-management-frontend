import type { OfflineReportResult, OfflineSalesSummary, OfflineRecentSale } from "@/shared/infrastructure/market-desktop-config"

export function isDesktopReportsAvailable(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.reports?.getSalesSummary !== undefined
}

/**
 * Desktop offline report adapter.
 *
 * All report methods return results with staleness indication.
 * Server-aggregated reports are flagged as stale/unavailable when offline;
 * locally computed reports include explicit staleness metadata.
 */
export function createDesktopReportAdapter() {
  return {
    async getSalesSummary(): Promise<OfflineReportResult<OfflineSalesSummary>> {
      const bridge = window.marketDesktop?.reports
      if (!bridge) {
        return { success: false, error: "Desktop reports bridge is not available", staleness: "unavailable" }
      }
      return bridge.getSalesSummary() as Promise<OfflineReportResult<OfflineSalesSummary>>
    },

    async getRecentSales(limit = 10): Promise<OfflineReportResult<OfflineRecentSale[]>> {
      const bridge = window.marketDesktop?.reports
      if (!bridge) {
        return { success: false, error: "Desktop reports bridge is not available", staleness: "unavailable" }
      }
      return bridge.getRecentSales(limit) as Promise<OfflineReportResult<OfflineRecentSale[]>>
    },

    async getStaleness(): Promise<OfflineReportResult<{ lastSyncAt: string | null; pendingCount: number; isStale: boolean }>> {
      const bridge = window.marketDesktop?.reports
      if (!bridge) {
        return { success: false, error: "Desktop reports bridge is not available", staleness: "unavailable" }
      }
      return bridge.getStaleness() as Promise<OfflineReportResult<{ lastSyncAt: string | null; pendingCount: number; isStale: boolean }>>
    },
  }
}
