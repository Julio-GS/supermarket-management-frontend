export type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK" | "UNKNOWN_STOCK"

export function evaluateStockStatus(stock: number | null, stockMinimum: number): StockStatus {
  if (stock === null) {
    return "UNKNOWN_STOCK"
  }

  if (stock === 0) {
    return "OUT_OF_STOCK"
  }

  if (stock <= stockMinimum) {
    return "LOW_STOCK"
  }

  return "IN_STOCK"
}
