"use client"

import { useQuery } from "@tanstack/react-query"
import type { BusinessReport, ReportWindow } from "../domain/report-read-models"
import type { BusinessReportPort } from "./business-report-port"

export interface UseBusinessReportResult {
  report: BusinessReport | null
  isLoading: boolean
  error: string | null
}

const QUERY_KEY = ["reports", "business-report"]

export function useBusinessReport(
  port: BusinessReportPort,
  window: ReportWindow
): UseBusinessReportResult {
  const { data: raw, isLoading, error } = useQuery<BusinessReport | null>({
    queryKey: [...QUERY_KEY, window],
    queryFn: async () => {
      try {
        const report = await port.getReport(window)
        // Fail-closed validation: reject incomplete payloads
        if (
          !report ||
          !report.range ||
          report.totalCollectedAmount === undefined ||
          report.totalCollectedAmount === null ||
          !report.window
        ) {
          throw new Error("Report data is incomplete.")
        }
        return report
      } catch (e) {
        // Let React Query capture it — caller sees error, no partial UI renders
        throw e
      }
    },
    retry: false,
  })

  return {
    report: raw ?? null,
    isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Unable to load reports. Check your connection."
      : null,
  }
}
