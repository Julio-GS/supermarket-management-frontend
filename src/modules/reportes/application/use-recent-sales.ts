"use client"

import { useQuery } from "@tanstack/react-query"
import { REPORTS_RECENT_SALES_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import type { RecentSale } from "../domain/report-read-models"
import type { RecentSalesPort, Staleness } from "./recent-sales-port"

export interface UseRecentSalesResult {
  sales: RecentSale[]
  staleness: Staleness
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const RECENT_SALES_LIMIT = 6
const QUERY_KEY = [...REPORTS_RECENT_SALES_QUERY_KEY, RECENT_SALES_LIMIT]

export function useRecentSales(port: RecentSalesPort): UseRecentSalesResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => port.getRecentSales(RECENT_SALES_LIMIT),
  })

  const refresh = async () => {
    await refetch()
  }

  const sales = data?.sales ?? []
  const staleness = data?.staleness ?? "live"

  return {
    sales,
    staleness,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to load recent sales"
      : null,
    refresh,
  }
}
