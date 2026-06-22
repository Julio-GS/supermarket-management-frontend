import type { SalesSummary, ReportStats } from "../domain/report-read-models"

export interface SalesSummaryPort {
  getSalesSummary(): Promise<SalesSummary>
  getReportStats(): Promise<ReportStats>
}
