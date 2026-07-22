// Domain
export type {
  SalesByDay,
  TopProduct,
  SalesSummary,
  ReportStats,
  RecentSale,
  LowStockProduct,
  ReportWindow,
  ReportRange,
  BusinessReportBreakdownItem,
  BusinessReportTopProduct,
  BusinessReport,
} from "./domain/report-read-models"

// Application
export type { SalesSummaryPort } from "./application/sales-summary-port"
export type { TopProductsPort } from "./application/top-products-port"
export type { RecentSalesPort, RecentSalesResult, Staleness } from "./application/recent-sales-port"
export type { LowStockPort } from "./application/low-stock-port"
export type { BusinessReportPort } from "./application/business-report-port"
export { useSalesSummary } from "./application/use-sales-summary"
export type { UseSalesSummaryResult } from "./application/use-sales-summary"
export { useTopProducts } from "./application/use-top-products"
export type { UseTopProductsResult } from "./application/use-top-products"
export { useRecentSales } from "./application/use-recent-sales"
export type { UseRecentSalesResult } from "./application/use-recent-sales"
export { useLowStock } from "./application/use-low-stock"
export type { UseLowStockResult } from "./application/use-low-stock"
export { useBusinessReport } from "./application/use-business-report"
export type { UseBusinessReportResult } from "./application/use-business-report"
export { useReportWindow } from "./application/use-report-window"
export type { UseReportWindowResult } from "./application/use-report-window"

// Infrastructure
export { createMockReportRepository } from "./infrastructure/mock-report-repository"
export { createApiRecentSalesAdapter } from "./infrastructure/api-recent-sales-adapter"
export { createApiBusinessReportAdapter } from "./infrastructure/api-business-report-adapter"
export { reportRepository, businessReportPort } from "./infrastructure/report-repository-instance"

// Composition
export { ReportesShell } from "./composition/reportes-shell"
export { SalesChartShell } from "./composition/sales-chart-shell"
export { RecentSalesShell } from "./composition/recent-sales-shell"
export { LowStockShell } from "./composition/low-stock-shell"

// Presentation
export type { SalesChartProps } from "./presentation/sales-chart"
export { TopProducts } from "./presentation/top-products"
export type { TopProductsProps } from "./presentation/top-products"
export { RecentSales } from "./presentation/recent-sales"
export type { RecentSalesProps } from "./presentation/recent-sales"
export { LowStock } from "./presentation/low-stock"
export type { LowStockProps } from "./presentation/low-stock"
