import { apiRequest } from "@/shared/infrastructure/api-client"
import type { BusinessReportPort } from "../application/business-report-port"
import type { BusinessReport, ReportQuery } from "../domain/report-read-models"
import { argentinaLocalDayToUtcRange } from "../domain/argentina-date-boundary"

function buildQueryString(query: ReportQuery): string {
  switch (query.kind) {
    case "fixed":
      return `/reports?window=${query.window}`
    case "custom-single-day": {
      const range = argentinaLocalDayToUtcRange(query.date)
      return `/reports?from=${range.from}&to=${range.to}`
    }
    case "custom-range": {
      const start = argentinaLocalDayToUtcRange(query.startDate)
      const end = argentinaLocalDayToUtcRange(query.endDate)
      return `/reports?from=${start.from}&to=${end.to}`
    }
  }
}

export function createApiBusinessReportAdapter(): BusinessReportPort {
  return {
    async getReport(query: ReportQuery): Promise<BusinessReport> {
      const data = await apiRequest<BusinessReport>(buildQueryString(query))
      return data
    },
  }
}
