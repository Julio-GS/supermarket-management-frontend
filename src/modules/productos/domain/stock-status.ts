export type StockStatus =
  | "NON_STOCK"
  | "NEGATIVE_STOCK"
  | "OUT_OF_STOCK"
  | "LOW_STOCK"
  | "IN_STOCK"

export function evaluateStockStatus(stock: number | null, stockMinimum: number): StockStatus {
  if (stock === null) {
    return "NON_STOCK"
  }

  if (stock < 0) {
    return "NEGATIVE_STOCK"
  }

  if (stock === 0) {
    return "OUT_OF_STOCK"
  }

  if (stock <= stockMinimum) {
    return "LOW_STOCK"
  }

  return "IN_STOCK"
}
