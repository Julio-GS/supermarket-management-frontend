// Domain
export type {
  SalesByDay,
  TopProduct,
  SalesSummary,
  ReportStats,
  RecentSale,
  LowStockProduct,
} from "./domain/report-read-models"

// Application
export type { SalesSummaryPort } from "./application/sales-summary-port"
export type { TopProductsPort } from "./application/top-products-port"
export type { RecentSalesPort } from "./application/recent-sales-port"
export type { LowStockPort } from "./application/low-stock-port"
export { useSalesSummary } from "./application/use-sales-summary"
export type { UseSalesSummaryResult } from "./application/use-sales-summary"
export { useTopProducts } from "./application/use-top-products"
export type { UseTopProductsResult } from "./application/use-top-products"
export { useRecentSales } from "./application/use-recent-sales"
export type { UseRecentSalesResult } from "./application/use-recent-sales"
export { useLowStock } from "./application/use-low-stock"
export type { UseLowStockResult } from "./application/use-low-stock"

// Infrastructure
export { createMockReportRepository } from "./infrastructure/mock-report-repository"
export { reportRepository } from "./infrastructure/report-repository-instance"

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
