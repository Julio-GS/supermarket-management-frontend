"use client"

import { useCallback, useState } from "react"
import type { ReportStats, SalesSummary } from "../domain/report-read-models"
import type { SalesSummaryPort } from "./sales-summary-port"

export interface UseSalesSummaryResult {
  summary: SalesSummary | null
  stats: ReportStats | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useSalesSummary(port: SalesSummaryPort): UseSalesSummaryResult {
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextSummary, nextStats] = await Promise.all([
        port.getSalesSummary(),
        port.getReportStats(),
      ])
      setSummary(nextSummary)
      setStats(nextStats)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sales summary"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [port])

  return { summary, stats, isLoading, error, refresh }
}
