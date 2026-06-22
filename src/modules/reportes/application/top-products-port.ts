import type { TopProduct } from "../domain/report-read-models"

export interface TopProductsPort {
  getTopProducts(limit?: number): Promise<TopProduct[]>
}
