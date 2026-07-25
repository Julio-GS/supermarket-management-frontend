"use client"

import { useQuery } from "@tanstack/react-query"
import { REPORTS_SALES_SUMMARY_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import type { ReportStats, SalesSummary } from "../domain/report-read-models"
import type { SalesSummaryPort } from "./sales-summary-port"

export interface UseSalesSummaryResult {
  summary: SalesSummary | null
  stats: ReportStats | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

interface SalesSummaryData {
  summary: SalesSummary
  stats: ReportStats
}

const QUERY_KEY = REPORTS_SALES_SUMMARY_QUERY_KEY

export function useSalesSummary(port: SalesSummaryPort): UseSalesSummaryResult {
  const { data, isLoading, error, refetch } = useQuery<SalesSummaryData>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const [summary, stats] = await Promise.all([
        port.getSalesSummary(),
        port.getReportStats(),
      ])
      return { summary, stats }
    },
  })

  const refresh = async () => {
    await refetch()
  }

  return {
    summary: data?.summary ?? null,
    stats: data?.stats ?? null,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to load sales summary"
      : null,
    refresh,
  }
}
