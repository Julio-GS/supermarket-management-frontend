import type { LowStockProduct } from "../domain/report-read-models"

export interface LowStockPort {
  getLowStockProducts(): Promise<LowStockProduct[]>
}
