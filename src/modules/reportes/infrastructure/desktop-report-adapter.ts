import type { BusinessReport, BusinessReportBreakdownItem, BusinessReportTopProduct, ReportWindow } from "../domain/report-read-models"
import type {
  OfflineReportResult,
  OfflineRecentSale,
  OfflineSalesSummary,
  SaleDesktopRecord,
} from "@/shared/infrastructure/market-desktop-config"

function getDesktopBridge() {
  if (typeof window !== "undefined" && window.marketDesktop) {
    return window.marketDesktop
  }
  return (globalThis as typeof globalThis & { marketDesktop?: Window["marketDesktop"] }).marketDesktop
}

function getWindowRange(window: ReportWindow, now = new Date()): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(now)
  const endsAt = new Date(now)

  if (window === "day") {
    startsAt.setHours(0, 0, 0, 0)
    endsAt.setHours(23, 59, 59, 999)
    return { startsAt, endsAt }
  }

  if (window === "week") {
    const day = now.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    startsAt.setDate(now.getDate() - diffToMonday)
    startsAt.setHours(0, 0, 0, 0)
    endsAt.setDate(startsAt.getDate() + 6)
    endsAt.setHours(23, 59, 59, 999)
    return { startsAt, endsAt }
  }

  startsAt.setDate(1)
  startsAt.setHours(0, 0, 0, 0)
  endsAt.setMonth(now.getMonth() + 1, 0)
  endsAt.setHours(23, 59, 59, 999)
  return { startsAt, endsAt }
}

function isInRange(createdAt: string, range: { startsAt: Date; endsAt: Date }): boolean {
  const value = new Date(createdAt)
  return !Number.isNaN(value.getTime()) && value >= range.startsAt && value <= range.endsAt
}

function sumDecimalStrings(values: string[]): string {
  const total = values.reduce((acc, value) => acc + Number.parseFloat(value || "0"), 0)
  return total.toFixed(2)
}

function buildBusinessReport(window: ReportWindow, sales: SaleDesktopRecord[]): BusinessReport {
  const range = getWindowRange(window)
  const filteredSales = sales.filter((sale) => isInRange(sale.createdAt, range))

  const paymentTotals = new Map<string, number>()
  const topProducts = new Map<string, BusinessReportTopProduct>()

  for (const sale of filteredSales) {
    for (const payment of sale.paymentMethods ?? []) {
      paymentTotals.set(payment.method, (paymentTotals.get(payment.method) ?? 0) + Number.parseFloat(payment.amount || "0"))
    }

    for (const item of sale.items ?? []) {
      const key = item.productId
      const existing = topProducts.get(key)
      if (existing) {
        existing.units_sold += item.quantity
        continue
      }
      topProducts.set(key, {
        productId: key,
        detalle: item.name,
        units_sold: item.quantity,
      })
    }
  }

  const paymentMethodBreakdown: BusinessReportBreakdownItem[] = Array.from(paymentTotals.entries())
    .map(([method, amount]) => ({ method, amount: amount.toFixed(2) }))
    .sort((left, right) => Number.parseFloat(right.amount) - Number.parseFloat(left.amount))

  return {
    window,
    range: {
      startsAt: range.startsAt.toISOString(),
      endsAt: range.endsAt.toISOString(),
    },
    totalCollectedAmount: sumDecimalStrings(filteredSales.map((sale) => sale.total)),
    paymentMethodBreakdown,
    topProducts: Array.from(topProducts.values()).sort((left, right) => right.units_sold - left.units_sold),
  }
}

export function isDesktopReportsAvailable(): boolean {
  const bridge = getDesktopBridge()
  return bridge?.reports?.getSalesSummary !== undefined || bridge?.sales?.list !== undefined
}

/**
 * Desktop offline report adapter.
 *
 * Uses the dedicated reports bridge when available and falls back to the local
 * sales history bridge for windowed business reports so desktop sales appear in
 * report pages immediately after checkout.
 */
export function createDesktopReportAdapter() {
  return {
    async getSalesSummary(): Promise<OfflineReportResult<OfflineSalesSummary>> {
      const bridge = getDesktopBridge()?.reports
      if (!bridge) {
        return { success: false, error: "Desktop reports bridge is not available", staleness: "unavailable" }
      }
      return bridge.getSalesSummary() as Promise<OfflineReportResult<OfflineSalesSummary>>
    },

    async getRecentSales(limit = 10): Promise<OfflineReportResult<OfflineRecentSale[]>> {
      const bridge = getDesktopBridge()?.reports
      if (!bridge) {
        return { success: false, error: "Desktop reports bridge is not available", staleness: "unavailable" }
      }
      return bridge.getRecentSales(limit) as Promise<OfflineReportResult<OfflineRecentSale[]>>
    },

    async getBusinessReport(window: ReportWindow): Promise<BusinessReport> {
      const salesBridge = getDesktopBridge()?.sales
      if (!salesBridge?.list) {
        throw new Error("Desktop sales bridge is not available")
      }

      const sales = await salesBridge.list()
      return buildBusinessReport(window, sales)
    },

    async getStaleness(): Promise<OfflineReportResult<{ lastSyncAt: string | null; pendingCount: number; isStale: boolean }>> {
      const bridge = getDesktopBridge()?.reports
      if (!bridge) {
        return { success: false, error: "Desktop reports bridge is not available", staleness: "unavailable" }
      }
      return bridge.getStaleness() as Promise<OfflineReportResult<{ lastSyncAt: string | null; pendingCount: number; isStale: boolean }>>
    },
  }
}
