"use client"

import { useQuery } from "@tanstack/react-query"
import type { RecentSale } from "../domain/report-read-models"
import type { RecentSalesPort } from "./recent-sales-port"

export interface UseRecentSalesResult {
  sales: RecentSale[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const RECENT_SALES_LIMIT = 6
const QUERY_KEY = ["reports", "recent-sales", RECENT_SALES_LIMIT]

export function useRecentSales(port: RecentSalesPort): UseRecentSalesResult {
  const { data: sales = [], isLoading, error, refetch } = useQuery<RecentSale[]>({
    queryKey: QUERY_KEY,
    queryFn: () => port.getRecentSales(RECENT_SALES_LIMIT),
  })

  const refresh = async () => {
    await refetch()
  }

  return {
    sales,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to load recent sales"
      : null,
    refresh,
  }
}
