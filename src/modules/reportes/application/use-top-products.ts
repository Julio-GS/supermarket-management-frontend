"use client"

import { useCallback, useState } from "react"
import type { TopProduct } from "../domain/report-read-models"
import type { TopProductsPort } from "./top-products-port"

export interface UseTopProductsResult {
  products: TopProduct[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useTopProducts(port: TopProductsPort): UseTopProductsResult {
  const [products, setProducts] = useState<TopProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await port.getTopProducts(5)
      setProducts(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load top products"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [port])

  return { products, isLoading, error, refresh }
}
