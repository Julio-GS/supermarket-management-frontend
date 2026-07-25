import type { StockRepository } from "../application/stock-repository"

export function isDesktopStockAvailable(): boolean {
  if (typeof window === "undefined") return false
  return window.marketDesktop?.stock?.adjust !== undefined
}

export function createDesktopStockAdapter(): StockRepository {
  return {
    async getStock(productId: string) {
      const bridge = window.marketDesktop?.stock
      if (!bridge) throw new Error("Desktop stock bridge is not available")
      return bridge.get(productId)
    },

    async adjust(input) {
      const bridge = window.marketDesktop?.stock
      if (!bridge) throw new Error("Desktop stock bridge is not available")
      return bridge.adjust(input)
    },
  }
}
