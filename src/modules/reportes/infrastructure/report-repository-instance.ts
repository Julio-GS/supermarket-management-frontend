import { createMockReportRepository } from "./mock-report-repository"
import { createApiRecentSalesAdapter } from "./api-recent-sales-adapter"
import { createApiBusinessReportAdapter } from "./api-business-report-adapter"
import type { RecentSalesPort } from "../application/recent-sales-port"
import type { SalesSummaryPort } from "../application/sales-summary-port"
import type { TopProductsPort } from "../application/top-products-port"
import type { LowStockPort } from "../application/low-stock-port"
import type { BusinessReportPort } from "../application/business-report-port"

const mockRepo = createMockReportRepository()
const apiRecentSales = createApiRecentSalesAdapter()
const apiBusinessReport = createApiBusinessReportAdapter()

export const reportRepository: SalesSummaryPort & TopProductsPort & RecentSalesPort & LowStockPort & BusinessReportPort = {
  // Keep mock data for summary, top products, and low stock (not yet backed by real API)
  getSalesSummary: mockRepo.getSalesSummary.bind(mockRepo),
  getReportStats: mockRepo.getReportStats.bind(mockRepo),
  getTopProducts: mockRepo.getTopProducts.bind(mockRepo),
  getLowStockProducts: mockRepo.getLowStockProducts.bind(mockRepo),
  // Wire recent sales to real API
  getRecentSales: apiRecentSales.getRecentSales.bind(apiRecentSales),
  // Wire business reports to real API
  getReport: apiBusinessReport.getReport.bind(apiBusinessReport),
}

/** Standalone business report port — used by reportes/dashboard shells directly */
export const businessReportPort: BusinessReportPort = apiBusinessReport
