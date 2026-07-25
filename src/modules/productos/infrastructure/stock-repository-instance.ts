import type { StockRepository } from "../application/stock-repository"
import { createApiStockRepository } from "./api-stock-repository"
import { createDesktopStockAdapter, isDesktopStockAvailable } from "./desktop-stock-adapter"

const apiRepository = createApiStockRepository()
let desktopRepository: ReturnType<typeof createDesktopStockAdapter> | null = null

function getStockRepository(): StockRepository {
  if (!isDesktopStockAvailable()) {
    return apiRepository
  }

  if (!desktopRepository) {
    desktopRepository = createDesktopStockAdapter()
  }

  return desktopRepository
}

export const stockRepository: StockRepository = {
  getStock(productId) {
    return getStockRepository().getStock(productId)
  },
  adjust(input) {
    return getStockRepository().adjust(input)
  },
}
