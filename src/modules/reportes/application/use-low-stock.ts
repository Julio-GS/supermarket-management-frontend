"use client"

import { useCallback, useState } from "react"
import type { LowStockProduct } from "../domain/report-read-models"
import type { LowStockPort } from "./low-stock-port"

export interface UseLowStockResult {
  products: LowStockProduct[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useLowStock(port: LowStockPort): UseLowStockResult {
  const [products, setProducts] = useState<LowStockProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await port.getLowStockProducts()
      setProducts(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load low stock products"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [port])

  return { products, isLoading, error, refresh }
}
