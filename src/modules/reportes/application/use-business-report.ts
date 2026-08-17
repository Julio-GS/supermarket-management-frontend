"use client"

import { useQuery } from "@tanstack/react-query"
import { REPORTS_BUSINESS_REPORT_QUERY_KEY } from "@/shared/infrastructure/query-keys"
import type { BusinessReport, BusinessReportWindow, ReportQuery } from "../domain/report-read-models"
import type { BusinessReportPort } from "./business-report-port"

export interface UseBusinessReportResult {
  report: BusinessReport | null
  isLoading: boolean
  error: string | null
}

const QUERY_KEY = REPORTS_BUSINESS_REPORT_QUERY_KEY

const VALID_WINDOWS: BusinessReportWindow[] = ["day", "week", "month", "custom"]

function isValidFiscalGrouping(fiscal: unknown): boolean {
  if (!fiscal || typeof fiscal !== "object") return false
  const value = fiscal as Record<string, unknown>
  return (["issued", "none", "incident"] as const).every((key) => {
    const bucket = value[key]
    if (!bucket || typeof bucket !== "object") return false
    const b = bucket as Record<string, unknown>
    return typeof b.amount === "string" && typeof b.sale_count === "number"
  })
}

/** Build a canonical scalar query key from a ReportQuery — never an unstable object. */
function queryKeyFromReportQuery(query: ReportQuery): readonly [...typeof QUERY_KEY, ...string[]] {
  switch (query.kind) {
    case "fixed":
      return [...QUERY_KEY, "fixed", query.window]
    case "custom-single-day":
      return [...QUERY_KEY, "custom-single-day", query.date]
    case "custom-range":
      return [...QUERY_KEY, "custom-range", query.startDate, query.endDate]
  }
}

export function useBusinessReport(
  port: BusinessReportPort,
  query: ReportQuery
): UseBusinessReportResult {
  const { data: raw, isLoading, error } = useQuery<BusinessReport | null>({
    queryKey: queryKeyFromReportQuery(query),
    queryFn: async () => {
      try {
        const report = await port.getReport(query)
        // Fail-closed validation: reject incomplete payloads
        if (
          !report ||
          !report.range ||
          report.totalCollectedAmount === undefined ||
          report.totalCollectedAmount === null ||
          !report.window ||
          !(VALID_WINDOWS as string[]).includes(report.window) ||
          !Array.isArray(report.paymentMethodBreakdown) ||
          !Array.isArray(report.topProducts) ||
          !isValidFiscalGrouping(report.fiscal)
        ) {
          throw new Error("Report data is incomplete.")
        }
        return {
          ...report,
          fiscalIncidentAvailability: report.fiscalIncidentAvailability ?? "complete",
        }
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
