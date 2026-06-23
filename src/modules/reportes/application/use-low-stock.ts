"use client"

import { useQuery } from "@tanstack/react-query"
import type { LowStockProduct } from "../domain/report-read-models"
import type { LowStockPort } from "./low-stock-port"

export interface UseLowStockResult {
  products: LowStockProduct[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const QUERY_KEY = ["reports", "low-stock"]

export function useLowStock(port: LowStockPort): UseLowStockResult {
  const { data: products = [], isLoading, error, refetch } = useQuery<LowStockProduct[]>({
    queryKey: QUERY_KEY,
    queryFn: () => port.getLowStockProducts(),
  })

  const refresh = async () => {
    await refetch()
  }

  return {
    products,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to load low stock products"
      : null,
    refresh,
  }
}
