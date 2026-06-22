import type { RecentSale } from "../domain/report-read-models"

export interface RecentSalesPort {
  getRecentSales(limit?: number): Promise<RecentSale[]>
}
