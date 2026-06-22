"use client"

import { useCallback, useState } from "react"
import type { RecentSale } from "../domain/report-read-models"
import type { RecentSalesPort } from "./recent-sales-port"

export interface UseRecentSalesResult {
  sales: RecentSale[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRecentSales(port: RecentSalesPort): UseRecentSalesResult {
  const [sales, setSales] = useState<RecentSale[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await port.getRecentSales(6)
      setSales(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load recent sales"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [port])

  return { sales, isLoading, error, refresh }
}
