export type StockStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK"

export function evaluateStockStatus(stock: number, stockMinimum: number): StockStatus {
  if (stock === 0) {
    return "OUT_OF_STOCK"
  }
  if (stock <= stockMinimum) {
    return "LOW_STOCK"
  }
  return "IN_STOCK"
}
