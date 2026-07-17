/**
 * Stock adjustment domain types and pure validation.
 *
 * All validation is client-side and free of UI labels.
 */
export interface AdjustStockInput {
  productId: string
  quantity: number
  reason?: string
}

export interface StockMovement {
  id: string
  productId: string
  quantity: number
  type: "sale" | "adjustment" | "initialization"
  referenceId: string | null
  previousStock: number
  newStock: number
  reason: string | null
  createdAt: string
}

/**
 * Validates that the adjustment quantity is a finite integer.
 * Returns null for valid values; returns a descriptive error message otherwise.
 */
export function validateAdjustmentQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity)) {
    return "La cantidad debe ser un número finito"
  }
  if (!Number.isInteger(quantity)) {
    return "La cantidad debe ser un número entero"
  }
  return null
}
