import type { AdjustStockInput, StockMovement } from "../domain/stock-adjustment"

/**
 * Domain-facing stock operations port.
 *
 * Returns domain values only; DTO mapping stays in infrastructure.
 */
export interface StockRepository {
  /** Returns the current stock for the product, or null for non-stock products. */
  getStock(productId: string): Promise<number | null>

  /** Submits a manual stock adjustment and returns the resulting movement. */
  adjust(input: AdjustStockInput): Promise<StockMovement>
}
