import {
  seedSalesByDay,
  seedTopProducts,
  seedRecentSales,
  seedLowStockProducts,
  seedReportStats,
} from "./mock-report-data"
import type {
  LowStockProduct,
  RecentSale,
  ReportStats,
  SalesSummary,
  TopProduct,
} from "../domain/report-read-models"
import type { SalesSummaryPort } from "../application/sales-summary-port"
import type { TopProductsPort } from "../application/top-products-port"
import type { RecentSalesPort } from "../application/recent-sales-port"
import type { LowStockPort } from "../application/low-stock-port"

export function createMockReportRepository(): SalesSummaryPort & TopProductsPort & RecentSalesPort & LowStockPort {
  return {
    async getSalesSummary(): Promise<SalesSummary> {
      return {
        salesByDay: seedSalesByDay,
      }
    },

    async getReportStats(): Promise<ReportStats> {
      return seedReportStats
    },

    async getTopProducts(limit = 5): Promise<TopProduct[]> {
      return seedTopProducts.slice(0, limit)
    },

    async getRecentSales(limit = 6): Promise<RecentSale[]> {
      return seedRecentSales.slice(0, limit) as unknown as RecentSale[]
    },

    async getLowStockProducts(): Promise<LowStockProduct[]> {
      return seedLowStockProducts
    },
  }
}
