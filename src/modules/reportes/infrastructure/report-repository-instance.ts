import { createMockReportRepository } from "./mock-report-repository"
import { createApiRecentSalesAdapter } from "./api-recent-sales-adapter"
import { createApiBusinessReportAdapter } from "./api-business-report-adapter"
import { createDesktopReportAdapter, isDesktopReportsAvailable } from "./desktop-report-adapter"
import type { RecentSalesPort, Staleness } from "../application/recent-sales-port"
import type { SalesSummaryPort } from "../application/sales-summary-port"
import type { TopProductsPort } from "../application/top-products-port"
import type { LowStockPort } from "../application/low-stock-port"
import type { BusinessReportPort } from "../application/business-report-port"

const mockRepo = createMockReportRepository()
const apiRecentSales = createApiRecentSalesAdapter()
const apiBusinessReport = createApiBusinessReportAdapter()

/** Desktop report adapter — used for staleness-aware offline reports when running in Electron. */
const desktopReports = isDesktopReportsAvailable()
  ? createDesktopReportAdapter()
  : null

/**
 * Primary report repository.
 *
 * When running inside the desktop shell with the offline reports bridge
 * available, recent sales and staleness-aware queries are routed through the
 * desktop adapter so the UI can show stale/offline indicators.  The desktop
 * adapter returns data wrapped with `{ success, staleness, data }` metadata
 * that the presentation layer can use for AC-13 compliance.
 *
 * Fallback: when the desktop bridge is absent, API adapters serve live data.
 */
export const reportRepository: SalesSummaryPort & TopProductsPort & RecentSalesPort & LowStockPort & BusinessReportPort = {
  // Keep mock data for summary, top products, and low stock (not yet backed by real API)
  getSalesSummary: mockRepo.getSalesSummary.bind(mockRepo),
  getReportStats: mockRepo.getReportStats.bind(mockRepo),
  getTopProducts: mockRepo.getTopProducts.bind(mockRepo),
  getLowStockProducts: mockRepo.getLowStockProducts.bind(mockRepo),

  // Recent sales: desktop adapter when available, API otherwise.
  // The desktop adapter returns staleness metadata alongside data.
  getRecentSales: async (limit) => {
    if (desktopReports) {
      const result = await desktopReports.getRecentSales(limit)
      if (result.success && result.data) {
        // Map desktop OfflineRecentSale[] to the domain RecentSale shape.
        // The desktop adapter returns `createdAt` ISO strings; the domain
        // expects `created_at`.
        const staleness: Staleness = result.staleness ?? "stale"
        return {
          sales: result.data.map((s) => ({
            id: s.id,
            date: s.createdAt,
            customer: s.customer,
            total: s.total,
            paymentMethods: [],
          })),
          staleness,
        }
      }
      // Desktop adapter failed — fall through to API
    }
    return apiRecentSales.getRecentSales(limit)
  },

  // Business reports: compute locally on desktop when the local sales bridge is
  // available so the UI reflects local-first sales immediately after checkout.
  getReport: async (query) => {
    if (desktopReports) {
      return desktopReports.getBusinessReport(query)
    }
    return apiBusinessReport.getReport(query)
  },
}

/** Standalone business report port — used by reportes/dashboard shells directly */
export const businessReportPort: BusinessReportPort = {
  getReport: reportRepository.getReport,
}

/** Desktop report adapter — available for staleness-aware reporting when running in Electron */
export { desktopReports, isDesktopReportsAvailable }
