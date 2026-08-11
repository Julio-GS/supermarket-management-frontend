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
 * UI input-intent validation: requires a strictly positive integer.
 * Used by the stock adjust dialog to validate the entered (unsigned) quantity.
 * Returns null for valid values; returns a descriptive error message otherwise.
 */
export function validateAdjustmentQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity)) {
    return "La cantidad debe ser un número finito"
  }
  if (!Number.isInteger(quantity)) {
    return "La cantidad debe ser un número entero"
  }
  if (quantity <= 0) {
    return "La cantidad debe ser un número positivo"
  }
  return null
}

/**
 * Application/repository signed-boundary validation: requires a non-zero finite integer.
 * Used by the stock adjustment hook to validate signed DTO quantities.
 * Returns null for valid values; returns a descriptive error message otherwise.
 */
export function validateSignedAdjustmentQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity)) {
    return "La cantidad debe ser un número finito"
  }
  if (!Number.isInteger(quantity)) {
    return "La cantidad debe ser un número entero"
  }
  if (quantity === 0) {
    return "La cantidad no puede ser cero"
  }
  return null
}
