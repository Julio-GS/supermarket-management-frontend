import type { RecentSale } from "../domain/report-read-models"

export type Staleness = "live" | "stale" | "unavailable"

export interface RecentSalesResult {
  sales: RecentSale[]
  staleness: Staleness
}

export interface RecentSalesPort {
  getRecentSales(limit?: number): Promise<RecentSalesResult>
}
